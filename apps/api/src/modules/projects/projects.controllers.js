import { PrismaClient } from '@prisma/client';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';
import { CacheService } from '../../services/cache.service.js';
import { trackEvent } from '../analytics/analytics.service.js';

const prisma = new PrismaClient();

// Create a new project
export const createProject = catchAsync(async (req, res, next) => {
  const { name, description } = req.body;
  const userId = req.user.id; // from requireAuth

  if (!name) {
    return next(new AppError('Project name is required', 400));
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      ownerId: userId,
    }
  });

  res.status(201).json({
    status: 'success',
    data: { project }
  });
});

// Get all projects for a user
export const getProjects = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({
    status: 'success',
    data: { projects }
  });
});

// Get a project by ID (includes files) with Redis Cache-Aside
export const getProject = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const project = await CacheService.getOrSet(`project:${id}`, 60, async () => {
    return prisma.project.findUnique({
      where: { id },
      include: { files: true }
    });
  });

  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { project }
  });
});

// Create a new file in a project
export const createFile = catchAsync(async (req, res, next) => {
  const { id: projectId } = req.params;
  const { name, path, content = '' } = req.body;

  if (!name || !path) {
    return next(new AppError('File name and path are required', 400));
  }

  // Verify project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  // Check if file path already exists in this project
  const existingFile = await prisma.file.findFirst({
    where: { projectId, path }
  });

  if (existingFile) {
    return next(new AppError('File with this path already exists', 400));
  }

  const file = await prisma.file.create({
    data: {
      name,
      path,
      content,
      projectId
    }
  });

  // Invalidate cached project file tree
  await CacheService.del(`project:${projectId}`);

  // Track telemetry event asynchronously
  trackEvent('FILE_SAVE', {
    userId: req.user?.id,
    metadata: { projectId, path: file.path, action: 'create' }
  });

  res.status(201).json({
    status: 'success',
    data: { file }
  });
});

// Update file content
export const updateFile = catchAsync(async (req, res, next) => {
  const { id: projectId, fileId } = req.params;
  const { content } = req.body;

  const file = await prisma.file.findFirst({
    where: { id: fileId, projectId }
  });

  if (!file) {
    return next(new AppError('File not found', 404));
  }

  const updatedFile = await prisma.file.update({
    where: { id: fileId },
    data: { content }
  });

  // Invalidate cached project file tree
  await CacheService.del(`project:${projectId}`);

  // Track telemetry event asynchronously
  trackEvent('FILE_SAVE', {
    userId: req.user?.id,
    metadata: { projectId, fileId, action: 'update' }
  });

  res.status(200).json({
    status: 'success',
    data: { file: updatedFile }
  });
});

// Rename file or folder
export const renameFileOrFolder = catchAsync(async (req, res, next) => {
  const { id: projectId } = req.params;
  const { oldPath, newPath } = req.body;

  if (!oldPath || !newPath) {
    return next(new AppError('Old and new paths are required', 400));
  }

  // Find all files that start with the oldPath
  const files = await prisma.file.findMany({
    where: {
      projectId,
      path: {
        startsWith: oldPath
      }
    }
  });

  if (files.length === 0) {
    return next(new AppError('No files found to rename', 404));
  }

  // Transaction to update all files
  const updates = files.map(file => {
    const updatedPath = newPath + file.path.slice(oldPath.length);
    return prisma.file.update({
      where: { id: file.id },
      data: {
        path: updatedPath,
        name: file.path === oldPath ? newPath.split('/').pop() : file.name
      }
    });
  });

  await prisma.$transaction(updates);

  // Invalidate cached project file tree
  await CacheService.del(`project:${projectId}`);

  res.status(200).json({
    status: 'success',
    data: null
  });
});

// Delete file or folder
export const deleteFileOrFolder = catchAsync(async (req, res, next) => {
  const { id: projectId } = req.params;
  const { path } = req.query;

  if (!path) {
    return next(new AppError('Path query parameter is required', 400));
  }

  const result = await prisma.file.deleteMany({
    where: {
      projectId,
      path: {
        startsWith: path
      }
    }
  });

  if (result.count === 0) {
    return next(new AppError('No files found to delete', 404));
  }

  // Invalidate cached project file tree
  await CacheService.del(`project:${projectId}`);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Export project files as ZIP archive
export const exportProject = catchAsync(async (req, res, next) => {
  const { id: projectId } = req.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { files: true }
  });

  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  // Queue background compression job for RabbitMQ worker
  const { publishToQueue } = await import('../../config/rabbitmq.js');
  publishToQueue('compression_queue', {
    projectId,
    userId: req.user.id
  });

  // Track telemetry event
  trackEvent('EXPORT_ZIP', {
    userId: req.user.id,
    metadata: { projectId, projectName: project.name }
  });

  // Stream ZIP directly to client response
  const archiverModule = await import('archiver');
  const archiver = archiverModule.default || archiverModule;
  const archive = archiver('zip', { zlib: { level: 9 } });

  const safeProjectName = (project.name || 'project').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'project';
  res.attachment(`${safeProjectName}.zip`);
  res.setHeader('Content-Type', 'application/zip');

  archive.pipe(res);

  project.files.forEach((file) => {
    const cleanPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
    archive.append(file.content || '', { name: cleanPath });
  });

  await archive.finalize();
});

// Helper for filtering ignored paths during project imports
const isIgnoredPath = (filePath) => {
  const ignoredPatterns = [
    /(^|\/)\.git(\/|$)/i,
    /(^|\/)\.next(\/|$)/i,
    /(^|\/)node_modules(\/|$)/i,
    /(^|\/)dist(\/|$)/i,
    /(^|\/)build(\/|$)/i,
    /(^|\/)\.DS_Store$/i,
    /(^|\/)Thumbs\.db$/i,
    /(^|\/)\.idea(\/|$)/i,
    /(^|\/)\.vscode(\/|$)/i,
    /(^|\/)__pycache__(\/|$)/i,
    /\.(png|jpe?g|gif|webp|ico|svg|mp4|mov|webm|mp3|wav|zip|tar|gz|exe|dll|dylib|so|bin)$/i
  ];
  return ignoredPatterns.some(pattern => pattern.test(filePath));
};

// Import project from ZIP archive upload
export const importProjectZip = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  if (!req.file || !req.file.buffer) {
    return next(new AppError('Please provide a valid .zip file', 400));
  }

  const AdmZipModule = await import('adm-zip');
  const AdmZip = AdmZipModule.default || AdmZipModule;
  const zip = new AdmZip(req.file.buffer);
  const zipEntries = zip.getEntries();

  const projectName = req.body.name?.trim() || 
    req.file.originalname.replace(/\.zip$/i, '') || 
    'Imported Project';

  const extractedFiles = [];

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    let entryPath = entry.entryName.replace(/\\/g, '/');
    if (!entryPath.startsWith('/')) entryPath = '/' + entryPath;

    // Check if path is ignored or binary
    if (isIgnoredPath(entryPath)) continue;

    try {
      const content = entry.getData().toString('utf8');
      const name = entryPath.split('/').pop();
      if (name) {
        extractedFiles.push({
          name,
          path: entryPath,
          content: content || ''
        });
      }
    } catch (e) {
      // Skip non-utf8 unreadable files
      continue;
    }
  }

  if (extractedFiles.length === 0) {
    // Provide a default README if nothing readable was found
    extractedFiles.push({
      name: 'README.md',
      path: '/README.md',
      content: `# ${projectName}\n\nProject imported successfully.`
    });
  }

  // Create Project and Files in Database
  const project = await prisma.$transaction(async (tx) => {
    const newProj = await tx.project.create({
      data: {
        name: projectName,
        description: req.body.description || 'Imported from local archive',
        ownerId: userId
      }
    });

    const fileCreates = extractedFiles.map(f => ({
      projectId: newProj.id,
      name: f.name,
      path: f.path,
      content: f.content
    }));

    await tx.file.createMany({
      data: fileCreates
    });

    return newProj;
  });

  // Track telemetry event
  trackEvent('PROJECT_IMPORT', {
    userId,
    metadata: { projectId: project.id, fileCount: extractedFiles.length, type: 'zip' }
  });

  res.status(201).json({
    status: 'success',
    data: {
      project,
      importedFilesCount: extractedFiles.length
    }
  });
});

// Import project from client folder directory picker
export const importProjectFolder = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { name, description, files = [] } = req.body;

  if (!name || !name.trim()) {
    return next(new AppError('Project name is required', 400));
  }

  const validFiles = files
    .filter(f => f && f.path && !isIgnoredPath(f.path))
    .map(f => {
      let cleanPath = f.path.replace(/\\/g, '/');
      if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
      const fileName = f.name || cleanPath.split('/').pop();
      return {
        name: fileName,
        path: cleanPath,
        content: typeof f.content === 'string' ? f.content : ''
      };
    });

  if (validFiles.length === 0) {
    validFiles.push({
      name: 'index.js',
      path: '/index.js',
      content: '// Welcome to your imported project\nconsole.log("Hello OwlSync!");\n'
    });
  }

  const project = await prisma.$transaction(async (tx) => {
    const newProj = await tx.project.create({
      data: {
        name: name.trim(),
        description: description || 'Imported from local directory',
        ownerId: userId
      }
    });

    const fileCreates = validFiles.map(f => ({
      projectId: newProj.id,
      name: f.name,
      path: f.path,
      content: f.content
    }));

    await tx.file.createMany({
      data: fileCreates
    });

    return newProj;
  });

  // Track telemetry event
  trackEvent('PROJECT_IMPORT', {
    userId,
    metadata: { projectId: project.id, fileCount: validFiles.length, type: 'folder' }
  });

  res.status(201).json({
    status: 'success',
    data: {
      project,
      importedFilesCount: validFiles.length
    }
  });
});

