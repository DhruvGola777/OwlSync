import Docker from 'dockerode';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const docker = new Docker();
const prisma = new PrismaClient();

// Keep track of active streams and containers
const activeExecs = new Map(); // projectId -> stream
const containerPromises = new Map(); // projectId -> promise
const activeWatchers = new Set(); // projectId -> true
let ioInstance = null;

const watcherScript = `
const fs = require('fs');
const path = require('path');

const watchDir = '/workspace';
const ignoreDirs = ['node_modules', '.git'];
let lastFiles = new Set();

function isIgnored(filepath) {
  const parts = filepath.split(path.sep);
  return ignoreDirs.some(dir => parts.includes(dir)) || filepath.endsWith('.owl-watcher.js');
}

function walkDir(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      if (isIgnored(fullPath)) return;
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        const sub = walkDir(fullPath);
        if (sub.length === 0) {
          results.push(path.join(fullPath, '.keep'));
        }
        results = results.concat(sub);
      } else {
        results.push(fullPath);
      }
    });
  } catch (e) { }
  return results;
}

setInterval(() => {
  const currentFiles = new Set(walkDir(watchDir).map(p => p.substring(watchDir.length)));
  for (let file of currentFiles) {
    if (!lastFiles.has(file)) {
      console.log(JSON.stringify({ event: 'add', path: file.replace(/\\\\/g, '/') }));
    }
  }
  for (let file of lastFiles) {
    if (!currentFiles.has(file)) {
      console.log(JSON.stringify({ event: 'remove', path: file.replace(/\\\\/g, '/') }));
    }
  }
  lastFiles = currentFiles;
}, 1000);
`;

export const dockerService = {
  async getOrCreateContainer(projectId) {
    if (containerPromises.has(projectId)) {
      return containerPromises.get(projectId);
    }
    const promise = this._getOrCreateContainerInternal(projectId).finally(() => {
      containerPromises.delete(projectId);
    });
    containerPromises.set(projectId, promise);
    
    const container = await promise;
    this._ensureWatcher(projectId, container).catch(e => console.error('Watcher start failed:', e));
    return container;
  },

  async _getOrCreateContainerInternal(projectId) {
    const containerName = `owlsync-project-${projectId}`;
    
    try {
      const container = docker.getContainer(containerName);
      const info = await container.inspect();
      
      if (!info.State.Running) {
        await container.start();
      }
      return container;
    } catch (e) {
      // Container doesn't exist (404), create it
      if (e.statusCode === 404) {
        console.log(`Creating container for project ${projectId}`);
        
        try {
          await docker.getImage('node:20-alpine').inspect();
          // Image exists, no need to pull
        } catch (imgErr) {
          if (imgErr.statusCode === 404) {
            console.log('Pulling node:20-alpine image... (This will be much faster!)');
            await new Promise((resolve, reject) => {
              docker.pull('node:20-alpine', (err, stream) => {
                if (err) return reject(err);
                docker.modem.followProgress(stream, onFinished, onProgress);
                function onFinished(err, output) {
                  if (err) return reject(err);
                  resolve(output);
                }
                function onProgress(event) {}
              });
            });
          } else {
            throw imgErr;
          }
        }

        const container = await docker.createContainer({
          Image: 'node:20-alpine', // Lightweight alpine image for instant startup
          name: containerName,
          Hostname: 'owlsync',
          Env: ['PS1=\\e[1;32mowlsync\\e[0m:\\e[1;34m\\w\\e[0m\\$ '],
          Tty: true,
          Cmd: ['/bin/sh'],
          OpenStdin: true,
          StdinOnce: false,
          WorkingDir: '/workspace',
        });
        
        await container.start();
        
        // Fetch files from DB and write them to the container
        await this.syncFilesToContainer(projectId, container);
        
        return container;
      }
      throw e;
    }
  },

  setIo(io) {
    ioInstance = io;
  },

  async _ensureWatcher(projectId, container) {
    if (activeWatchers.has(projectId)) return;
    activeWatchers.add(projectId);

    try {
      await this.writeToContainerFile(container, '.owl-watcher.js', watcherScript);
      const exec = await container.exec({
        Cmd: ['node', '/workspace/.owl-watcher.js'],
        AttachStdout: true,
        AttachStderr: true,
        Tty: true
      });
      const stream = await exec.start({ hijack: true, stdin: false });

      let buffer = '';
      stream.on('data', async (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
          if (!jsonMatch) continue;
          try {
            const data = JSON.parse(jsonMatch[0]);
            await this._handleFileEvent(projectId, data, container);
          } catch (e) {
            // Not valid JSON
          }
        }
      });
    } catch (err) {
      console.error('Failed to start watcher for project', projectId, err);
      activeWatchers.delete(projectId);
    }
  },

  _resolveWorkspacePath(filePath) {
    if (!filePath) return '/workspace';
    const cleanPath = filePath.replace(/^\/+/, '');
    return path.posix.join('/workspace', cleanPath);
  },

  async readFileFromContainer(container, filePath) {
    try {
      const fullPath = this._resolveWorkspacePath(filePath);
      const exec = await container.exec({
        Cmd: ['/bin/sh', '-c', `[ -f "${fullPath}" ] && base64 "${fullPath}" || echo ""`],
        AttachStdout: true,
        AttachStderr: false
      });
      const stream = await exec.start();
      let output = '';
      await new Promise((resolve) => {
        stream.on('data', (chunk) => {
          output += chunk.toString('utf8');
        });
        stream.on('end', resolve);
        stream.on('error', resolve);
      });
      const cleaned = output.replace(/\r?\n/g, '').trim();
      if (!cleaned) return '';
      return Buffer.from(cleaned, 'base64').toString('utf8');
    } catch (e) {
      console.error('Failed to read file from container:', e);
      return '';
    }
  },

  activeUsersMap: new Map(), // projectId -> user

  setActiveUser(projectId, user) {
    if (projectId && user) {
      this.activeUsersMap.set(projectId, user);
    }
  },

  getActiveUser(projectId) {
    return this.activeUsersMap.get(projectId);
  },

  async _handleFileEvent(projectId, data, container) {
    const { event, path: filePath } = data;
    if (!filePath) return;
    try {
      if (event === 'add') {
        let content = '';
        if (container && !filePath.endsWith('.keep')) {
          content = await this.readFileFromContainer(container, filePath);
        }
        await prisma.file.upsert({
          where: { projectId_path: { projectId, path: filePath } },
          create: { projectId, path: filePath, name: filePath.split('/').pop(), content },
          update: { content } 
        });
      } else if (event === 'remove') {
        await prisma.file.deleteMany({
          where: { projectId, path: filePath }
        });
      }

      // Determine activity details for the session timeline
      const user = this.getActiveUser(projectId);
      const userName = user?.name || user?.username || 'Someone';
      const isKeepFile = filePath.endsWith('/.keep') || filePath === '/.keep' || filePath === '.keep';
      
      let activityType = null;
      let description = null;

      if (isKeepFile) {
        // Empty folder created/removed
        const folderName = filePath.replace(/\/?\.keep$/, '').split('/').filter(Boolean).pop() || 'folder';
        if (event === 'add') {
          activityType = 'FOLDER_CREATED';
          description = `${userName} created folder ${folderName}`;
        } else if (event === 'remove') {
          activityType = 'FOLDER_DELETED';
          description = `${userName} deleted folder ${folderName}`;
        }
      } else {
        const fileName = filePath.split('/').pop();
        if (event === 'add') {
          activityType = 'FILE_CREATED';
          description = `${userName} created ${fileName}`;
        } else if (event === 'remove') {
          activityType = 'FILE_DELETED';
          description = `${userName} deleted ${fileName}`;
        }
      }

      let newActivity = null;
      if (activityType && description) {
        try {
          newActivity = await prisma.activity.create({
            data: {
              projectId,
              userId: user?.id || null,
              type: activityType,
              description,
              metadata: { path: filePath, event }
            },
            include: {
              user: {
                select: { id: true, username: true, name: true, avatarUrl: true }
              }
            }
          });
        } catch (actErr) {
          console.error('Failed to save file activity to DB:', actErr);
        }
      }

      if (ioInstance) {
        const rooms = await prisma.room.findMany({ where: { projectId } });
        for (const room of rooms) {
          ioInstance.to(room.id).emit('project:files_changed');
          if (newActivity) {
            ioInstance.to(room.id).emit('project:activity', newActivity);
          }
        }
      }
    } catch (err) {
      console.error('Error handling file event:', err);
    }
  },

  async syncFilesToContainer(projectId, container) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { files: true }
      });

      if (!project || !project.files.length) return;

      // Use base64 encoding to write file contents safely
      for (const file of project.files) {
        await this.writeToContainerFile(container, file.path, file.content);
      }
    } catch (err) {
      console.error('Failed to sync files to container:', err);
    }
  },

  async writeToContainerFile(container, filePath, content) {
    const b64 = Buffer.from(content || '').toString('base64');
    const fullPath = this._resolveWorkspacePath(filePath);
    const dir = path.posix.dirname(fullPath);
    
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', `mkdir -p "${dir}" && echo "${b64}" | base64 -d > "${fullPath}"`],
      AttachStdout: true,
      AttachStderr: true
    });
    
    const stream = await exec.start();
    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
      stream.resume();
    });
  },

  async attachTerminal(projectId, socket, cols, rows) {
    try {
      const container = await this.getOrCreateContainer(projectId);
      
      // Ensure all project files from DB are synced to container
      await this.syncFilesToContainer(projectId, container);

      const exec = await container.exec({
        Cmd: ['/bin/sh'],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Env: ['TERM=xterm-256color']
      });

      const stream = await exec.start({
        hijack: true,
        stdin: true
      });

      if (cols && rows) {
        await exec.resize({ w: cols, h: rows });
      }

      activeExecs.set(projectId, { stream, exec });

      stream.on('data', (chunk) => {
        socket.emit('terminal:output', { data: chunk.toString('utf8') });
      });

      socket.emit('terminal:ready');

    } catch (err) {
      console.error('Failed to attach terminal:', err);
      socket.emit('terminal:error', { error: err.message });
    }
  },

  write(projectId, data) {
    const session = activeExecs.get(projectId);
    if (session && session.stream) {
      session.stream.write(data);
    }
  },

  async resize(projectId, cols, rows) {
    const session = activeExecs.get(projectId);
    if (session && session.exec) {
      try {
        await session.exec.resize({ w: cols, h: rows });
      } catch (err) {
        console.error('Failed to resize terminal:', err);
      }
    }
  }
};
