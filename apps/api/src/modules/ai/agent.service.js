
import { PrismaClient } from '@prisma/client';
import Docker from 'dockerode';
import path from 'path';
import { env } from '../../config/env.js';

const prisma = new PrismaClient();
const docker = new Docker();

// Tool Definitions for Gemini API
const GEMINI_AGENT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'create_file',
        description: 'Create a new file in the project with the specified path and content.',
        parameters: {
          type: 'OBJECT',
          properties: {
            path: { type: 'STRING', description: 'The relative file path, e.g. /src/utils/math.js or /index.html' },
            content: { type: 'STRING', description: 'The complete content of the file to create' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'edit_file',
        description: 'Edit or rewrite an existing file in the project with new content.',
        parameters: {
          type: 'OBJECT',
          properties: {
            path: { type: 'STRING', description: 'The relative file path to edit, e.g. /src/server.js' },
            content: { type: 'STRING', description: 'The updated full content of the file' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'delete_file',
        description: 'Delete a file from the project.',
        parameters: {
          type: 'OBJECT',
          properties: {
            path: { type: 'STRING', description: 'The relative file path to delete' }
          },
          required: ['path']
        }
      },
      {
        name: 'read_file',
        description: 'Read the contents of a file in the workspace.',
        parameters: {
          type: 'OBJECT',
          properties: {
            path: { type: 'STRING', description: 'The relative path of the file to read' }
          },
          required: ['path']
        }
      },
      {
        name: 'list_directory',
        description: 'List all files and folder hierarchy in the project workspace.',
        parameters: {
          type: 'OBJECT',
          properties: {
            path: { type: 'STRING', description: 'Directory path to list, defaults to root "/"' }
          }
        }
      },
      {
        name: 'search_codebase',
        description: 'Search across all files in the project for a symbol, function name, or text pattern.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search term or symbol to locate' }
          },
          required: ['query']
        }
      },
      {
        name: 'run_command',
        description: 'Execute a shell/terminal command inside the project Docker container (e.g. npm test, node script.js, npm i package).',
        parameters: {
          type: 'OBJECT',
          properties: {
            command: { type: 'STRING', description: 'The shell command to run in the workspace terminal' }
          },
          required: ['command']
        }
      }
    ]
  }
];

import https from 'https';

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

function streamSingleModel({ model, payload, onToken, apiKey }) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      timeout: 8000
    }, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', c => errBody += c);
        res.on('end', () => reject(new Error(`Gemini ${model} Error (${res.statusCode}): ${errBody}`)));
        return;
      }

      let buffer = '';
      const accumulatedParts = [];
      let lastCandidate = null;

      res.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const data = JSON.parse(jsonStr);
            const candidate = data.candidates?.[0];
            if (!candidate) continue;
            lastCandidate = candidate;

            const parts = candidate.content?.parts || [];
            for (const part of parts) {
              if (part.text) {
                onToken?.(part.text);
              }
              accumulatedParts.push(part);
            }
          } catch (e) {
            // Ignore partial SSE chunk parse error
          }
        }
      });

      res.on('end', () => {
        if (buffer.trim().startsWith('data:')) {
          try {
            const data = JSON.parse(buffer.trim().replace(/^data:\s*/, ''));
            const candidate = data.candidates?.[0];
            if (candidate) {
              lastCandidate = candidate;
              const parts = candidate.content?.parts || [];
              for (const part of parts) {
                if (part.text) onToken?.(part.text);
                accumulatedParts.push(part);
              }
            }
          } catch (e) {}
        }

        resolve({
          candidate: lastCandidate,
          parts: accumulatedParts
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Gemini ${model} request timed out`));
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function streamGeminiWithFallback({ payload, onToken, apiKey }) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      return await streamSingleModel({ model, payload, onToken, apiKey });
    } catch (err) {
      console.warn(`Model ${model} returned error, falling back to next model...`, err.message.substring(0, 100));
      lastError = err;
    }
  }
  throw lastError || new Error('All Gemini model candidates failed');
}

function normalizeWorkspacePath(rawPath) {
  if (!rawPath) return '/index.js';
  let clean = String(rawPath).replace(/\\/g, '/').trim();
  clean = clean.replace(/^(\.?\/)?workspace(\/|$)/, '/');
  clean = clean.replace(/^\.\//, '/');
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  return clean;
}

export class AgentService {
  /**
   * Run agentic pair programmer session with Server-Sent Events (SSE) streaming
   */
  static async runAgentSession({
    projectId,
    userPrompt,
    activeFile,
    selectedCode,
    contextFiles = [],
    history = [],
    onEvent // callback (event) => void
  }) {
    let project = null;
    let filesList = [];

    if (projectId) {
      try {
        project = await prisma.project.findUnique({
          where: { id: projectId },
          include: { files: true }
        });
        if (project?.files) {
          filesList = project.files.map(f => ({ path: f.path, name: f.name }));
        }
      } catch (e) {
        console.warn('Could not query project files:', e);
      }
    }

    // Resolve any @file mentions from userPrompt if not already in contextFiles
    let allContextFiles = [...(contextFiles || [])];
    if (project?.files) {
      const mentionRegex = /@([a-zA-Z0-9_\-./]+)/g;
      let match;
      while ((match = mentionRegex.exec(userPrompt)) !== null) {
        const query = match[1].toLowerCase();
        const found = project.files.find(f => 
          f.path.toLowerCase().endsWith(query) || 
          f.name.toLowerCase() === query || 
          f.path.toLowerCase() === query
        );
        if (found && !allContextFiles.some(cf => cf.id === found.id || cf.path === found.path)) {
          allContextFiles.push({
            id: found.id,
            name: found.name,
            path: found.path,
            content: found.content
          });
        }
      }
    }

    const contextFilesSection = allContextFiles.length > 0
      ? `\n- Context / Mentioned Files (@files):\n` + allContextFiles.map(cf => `--- File: ${cf.path || cf.name} ---\n\`\`\`\n${cf.content || ''}\n\`\`\``).join('\n\n')
      : '';

    // Construct system instructions
    const systemPrompt = `You are OwlSync Agent, an expert AI Software Engineer and Pair Programmer with direct access to the project's codebase and terminal.

WORKSPACE CONTEXT:
- Project Name: ${project?.name || 'Active Workspace'}
- Available Files: ${filesList.length > 0 ? filesList.map(f => f.path).join(', ') : '(Empty project)'}
${activeFile ? `- Active File Open in Editor: ${activeFile.name} (${activeFile.path})\n\`\`\`\n${activeFile.content || ''}\n\`\`\`` : ''}
${selectedCode ? `- Active Code Selection by User:\n\`\`\`\n${selectedCode}\n\`\`\`` : ''}
${contextFilesSection}

FILE PATH RULES:
- All workspace file paths start with a forward slash and are relative to project root, e.g. "/index.js", "/package.json", "/src/server.js".
- NEVER prefix paths with "/workspace" or "./workspace" when calling tools.

AGENT RULES & CAPABILITIES:
1. CONVERSATIONAL & GREETING PROMPTS: For casual greetings (e.g. "hi", "hello", "hey", "who are you"), general questions, or coding advice that does not require modifying/inspecting files, reply directly, warmly, and concisely with text. DO NOT invoke tools for simple greetings or casual conversation.
2. AUTONOMOUS CODE EDITS: When asked to write, update, or create code, call the appropriate tool ('edit_file' or 'create_file') with the COMPLETE, production-ready code. Do NOT repeatedly read or re-read files.
3. CONCLUDE & EXPLAIN: Once you execute a tool action, finish your work and provide a clear explanation of what was created or modified so your response streams cleanly to the user.`;

    const apiKey = env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        await this._runGeminiAgentLoop({
          apiKey,
          projectId,
          userPrompt,
          systemPrompt,
          history,
          onEvent
        });
      } catch (geminiError) {
        console.warn('Gemini Agent encountered error, falling back to resilient heuristic execution:', geminiError.message);
        await this._runHeuristicAgent({
          projectId,
          userPrompt,
          activeFile,
          selectedCode,
          project,
          onEvent
        });
      }
    } else {
      // Fallback: Smart Heuristic Agent (executes tools and streams steps)
      await this._runHeuristicAgent({
        projectId,
        userPrompt,
        activeFile,
        selectedCode,
        project,
        onEvent
      });
    }

    onEvent({ type: 'done', message: 'Task completed successfully.' });
  }

  /**
   * Gemini Real-time Streaming Agent Loop with Function Calling
   */
  static async _runGeminiAgentLoop({ apiKey, projectId, userPrompt, systemPrompt, history, onEvent }) {
    const validHistory = (history || [])
      .filter(h => h && typeof h.content === 'string' && h.content.trim().length > 0 && !h.isError && h.id !== 'welcome');

    const alternatingHistory = [];
    let expectedRole = 'user';

    for (const item of validHistory) {
      const role = item.role === 'assistant' ? 'model' : 'user';
      if (role === expectedRole) {
        alternatingHistory.push({
          role,
          parts: [{ text: item.content.trim() }]
        });
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      }
    }

    const contents = [
      ...alternatingHistory,
      { role: 'user', parts: [{ text: (userPrompt || 'Hello').trim() }] }
    ];

    let maxTurns = 4;
    let turnCount = 0;
    let hasExecutedTools = false;

    while (turnCount < maxTurns) {
      turnCount++;

      // If tools have already been executed, force model to generate final explanation text by omitting tools
      const shouldProvideTools = !hasExecutedTools && turnCount < maxTurns;

      const payload = {
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        ...(shouldProvideTools ? { tools: GEMINI_AGENT_TOOLS } : {}),
        generationConfig: {
          temperature: 0.2
        }
      };

      const { candidate, parts: rawParts } = await streamGeminiWithFallback({
        payload,
        apiKey,
        onToken: (token) => {
          onEvent({ type: 'token', text: token });
        }
      });

      if (!candidate && rawParts.length === 0) break;

      contents.push({ role: 'model', parts: rawParts });

      // Check for function calls
      const functionCalls = rawParts.filter(p => p.functionCall);

      if (functionCalls.length === 0) {
        // Finished pure text response
        break;
      }

      hasExecutedTools = true;

      // Execute function calls
      const functionResponses = [];

      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        const stepId = `step-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        onEvent({
          type: 'step',
          id: stepId,
          tool: name,
          label: this._formatStepLabel(name, args),
          status: 'running',
          args
        });

        const toolResult = await this._executeTool(name, args, projectId, onEvent);

        onEvent({
          type: 'step',
          id: stepId,
          tool: name,
          label: this._formatStepCompletedLabel(name, args, toolResult),
          status: 'completed',
          result: toolResult
        });

        functionResponses.push({
          functionResponse: {
            name,
            response: { output: toolResult }
          }
        });
      }

      // Feed function outputs back to model for next iteration
      contents.push({
        role: 'user',
        parts: functionResponses
      });
    }
  }

  /**
   * Tool Executor
   */
  static async _executeTool(name, args, projectId, onEvent) {
    try {
      if (name === 'create_file') {
        const cleanPath = normalizeWorkspacePath(args.path);
        const fileName = path.basename(cleanPath);
        let fileId = 'file-' + Date.now();

        if (projectId) {
          const file = await prisma.file.upsert({
            where: {
              projectId_path: { projectId, path: cleanPath }
            },
            update: { content: args.content, name: fileName },
            create: {
              name: fileName,
              path: cleanPath,
              content: args.content,
              projectId
            }
          });
          fileId = file.id;

          // Write to container
          await this._writeToContainer(projectId, cleanPath, args.content).catch(console.warn);

          // Record activity
          await prisma.activity.create({
            data: {
              type: 'FILE_CREATED',
              description: `AI Agent created ${cleanPath}`,
              projectId,
              metadata: { path: cleanPath, byAI: true }
            }
          }).catch(() => { });
        }

        onEvent({
          type: 'file_created',
          file: { id: fileId, name: fileName, path: cleanPath, content: args.content }
        });

        return { success: true, message: `Created file ${cleanPath} (${args.content.length} bytes)` };
      }

      if (name === 'edit_file') {
        const cleanPath = normalizeWorkspacePath(args.path);
        const fileName = path.basename(cleanPath);
        let originalContent = '';
        let fileId = 'file-' + Date.now();

        if (projectId) {
          const existing = await prisma.file.findFirst({
            where: { projectId, path: cleanPath }
          });
          originalContent = existing ? existing.content : '';

          const file = await prisma.file.upsert({
            where: {
              projectId_path: { projectId, path: cleanPath }
            },
            update: { content: args.content },
            create: {
              name: fileName,
              path: cleanPath,
              content: args.content,
              projectId
            }
          });
          fileId = file.id;

          await this._writeToContainer(projectId, cleanPath, args.content).catch(console.warn);
        }

        onEvent({
          type: 'diff',
          fileId,
          filePath: cleanPath,
          originalContent,
          newContent: args.content
        });

        onEvent({
          type: 'file_updated',
          file: { id: fileId, name: fileName, path: cleanPath, content: args.content }
        });

        return { success: true, message: `Updated file ${cleanPath}` };
      }

      if (name === 'delete_file') {
        const cleanPath = normalizeWorkspacePath(args.path);
        if (projectId) {
          await prisma.file.deleteMany({
            where: { projectId, path: cleanPath }
          });
          await this._execInContainer(projectId, `rm -f "/workspace${cleanPath}"`).catch(console.warn);
        }

        return { success: true, message: `Deleted file ${cleanPath}` };
      }

      if (name === 'read_file') {
        const cleanPath = normalizeWorkspacePath(args.path);
        if (projectId) {
          const file = await prisma.file.findFirst({
            where: { projectId, path: cleanPath }
          });

          if (file) return { content: file.content, path: cleanPath };

          // Fallback search by filename
          const fileByName = await prisma.file.findFirst({
            where: { projectId, name: path.basename(cleanPath) }
          });
          if (fileByName) return { content: fileByName.content, path: fileByName.path };

          // Try reading from container
          const containerOutput = await this._execInContainer(projectId, `cat "/workspace${cleanPath}"`);
          if (containerOutput.stdout) {
            return { content: containerOutput.stdout, path: cleanPath };
          }
        }
        return { content: '', path: cleanPath };
      }

      if (name === 'list_directory') {
        if (projectId) {
          const files = await prisma.file.findMany({
            where: { projectId },
            select: { path: true, name: true }
          });
          return { files: files.map(f => f.path) };
        }
        return { files: ['/index.js', '/package.json'] };
      }

      if (name === 'search_codebase') {
        if (projectId) {
          const files = await prisma.file.findMany({
            where: {
              projectId,
              content: { contains: args.query, mode: 'insensitive' }
            },
            select: { path: true, name: true }
          });
          return { matches: files.map(f => f.path) };
        }
        return { matches: [] };
      }

      if (name === 'run_command') {
        const output = await this._execInContainer(projectId, args.command);
        return {
          exitCode: output.exitCode,
          stdout: output.stdout,
          stderr: output.stderr
        };
      }

      return { error: `Unknown tool ${name}` };

    } catch (err) {
      console.error(`Tool execution error (${name}):`, err);
      return { error: err.message };
    }
  }

  static async _getProjectContainer(projectId) {
    if (!projectId) return null;
    try {
      const possibleNames = [
        `owlsync-project-${projectId}`,
        `owlsync-${projectId}`
      ];
      const containers = await docker.listContainers({ all: true }).catch(() => []);
      for (const name of possibleNames) {
        const found = containers.find(c => (c.Names || []).some(n => n === `/${name}` || n === name));
        if (found) {
          const container = docker.getContainer(found.Id);
          if (found.State !== 'running') {
            await container.start().catch(() => {});
          }
          return container;
        }
      }
      return docker.getContainer(`owlsync-project-${projectId}`);
    } catch (e) {
      return null;
    }
  }

  static async _writeToContainer(projectId, filePath, content) {
    if (!projectId) return;
    try {
      const container = await this._getProjectContainer(projectId);
      if (!container) return;

      const fullPath = `/workspace${filePath}`;
      const dir = path.dirname(fullPath).replace(/\\/g, '/');
      const base64Content = Buffer.from(content).toString('base64');

      const exec = await container.exec({
        Cmd: ['/bin/sh', '-c', `mkdir -p "${dir}" && echo "${base64Content}" | base64 -d > "${fullPath}"`],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      await new Promise((resolve) => {
        stream.on('end', resolve);
        stream.resume();
      });
    } catch (err) {
      console.warn(`Container write notice (${filePath}):`, err.message);
    }
  }

  static async _execInContainer(projectId, command) {
    if (!projectId) {
      return { exitCode: 0, stdout: 'Command simulated (no container attached)', stderr: '' };
    }
    try {
      const container = await this._getProjectContainer(projectId);
      if (!container) {
        return { exitCode: 0, stdout: 'Project container initializing...', stderr: '' };
      }

      const exec = await container.exec({
        Cmd: ['/bin/sh', '-c', `cd /workspace && ${command}`],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start();
      let stdout = '';
      let stderr = '';

      return new Promise((resolve) => {
        stream.on('data', chunk => {
          stdout += chunk.toString('utf8');
        });
        stream.on('end', async () => {
          try {
            const inspect = await exec.inspect();
            resolve({ exitCode: inspect.ExitCode || 0, stdout, stderr });
          } catch (e) {
            resolve({ exitCode: 0, stdout, stderr });
          }
        });
      });
    } catch (err) {
      console.warn(`Container exec notice ("${command}"):`, err.message);
      return { exitCode: 0, stdout: '', stderr: err.message };
    }
  }

  static _formatStepLabel(name, args) {
    switch (name) {
      case 'create_file': return `Creating ${args.path}...`;
      case 'edit_file': return `Editing ${args.path}...`;
      case 'delete_file': return `Deleting ${args.path}...`;
      case 'read_file': return `Reading ${args.path}...`;
      case 'list_directory': return `Scanning workspace directory...`;
      case 'search_codebase': return `Searching codebase for "${args.query}"...`;
      case 'run_command': return `Running "${args.command}" in terminal...`;
      default: return `Executing ${name}...`;
    }
  }

  static _formatStepCompletedLabel(name, args, result) {
    switch (name) {
      case 'create_file': return `Created ${args.path}`;
      case 'edit_file': return `Updated ${args.path}`;
      case 'delete_file': return `Deleted ${args.path}`;
      case 'read_file': return `Read ${args.path}`;
      case 'list_directory': return `Scanned workspace structure`;
      case 'search_codebase': return `Found ${(result.matches || []).length} matches`;
      case 'run_command': return `Executed "${args.command}" (Exit: ${result.exitCode || 0})`;
      default: return `Completed ${name}`;
    }
  }

  /**
   * Fallback heuristic agent when no API keys are provided or all models exhausted
   */
  static async _runHeuristicAgent({ projectId, userPrompt, activeFile, selectedCode, project, onEvent }) {
    if (userPrompt.toLowerCase().includes('create') || userPrompt.toLowerCase().includes('add') || userPrompt.toLowerCase().includes('file')) {
      const targetPath = userPrompt.includes('.js') ? '/src/demo.js' : '/src/helper.js';
      onEvent({ type: 'step', id: 'step-1', label: `Generating ${targetPath}...`, status: 'running' });
      await new Promise(r => setTimeout(r, 400));

      const sampleCode = `// Generated by OwlSync AI Agent\nexport const helper = () => {\n  console.log("OwlSync Agent operational");\n  return true;\n};\n`;
      await this._executeTool('create_file', { path: targetPath, content: sampleCode }, projectId, onEvent);
      onEvent({ type: 'step', id: 'step-1', label: `Created ${targetPath}`, status: 'completed' });
    }

    const fullResponse = `Hello! I'm **OwlSync Agent**, your autonomous pair programmer.\n\nI can create files, edit your codebase, run terminal commands, and inspect errors.\n\nHow can I help you with your project today?`;
    
    // Stream word by word
    const words = fullResponse.split(' ');
    for (const word of words) {
      onEvent({ type: 'token', text: word + ' ' });
      await new Promise(r => setTimeout(r, 25));
    }
  }
}
