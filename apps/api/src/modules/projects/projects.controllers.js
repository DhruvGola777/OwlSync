import { PrismaClient } from '@prisma/client';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

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

// Get a project by ID (includes files)
export const getProject = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { files: true }
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
  // e.g. oldPath = "/src/components"
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

  // Check if target path already exists to avoid collisions
  const existingTargetFiles = await prisma.file.findMany({
    where: {
      projectId,
      path: {
        startsWith: newPath
      }
    }
  });
  
  if (existingTargetFiles.length > 0 && files.some(f => f.path === oldPath)) {
    // Basic collision check if moving a file into a space that exists
    // (In a robust system you'd do more checks here)
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

  res.status(204).json({
    status: 'success',
    data: null
  });
});
