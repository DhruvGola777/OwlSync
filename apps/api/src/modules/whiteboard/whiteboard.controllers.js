import { PrismaClient } from '@prisma/client';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const prisma = new PrismaClient();

// Get whiteboard for a project
export const getWhiteboard = catchAsync(async (req, res, next) => {
  const { id: projectId } = req.params;

  // Find the project first to ensure it exists
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  // Find or create the whiteboard for this project
  let whiteboard = await prisma.whiteboard.findUnique({
    where: { projectId }
  });

  if (!whiteboard) {
    whiteboard = await prisma.whiteboard.create({
      data: {
        projectId,
        state: '' // Empty state
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      whiteboard
    }
  });
});

// Update whiteboard state
export const updateWhiteboard = catchAsync(async (req, res, next) => {
  const { id: projectId } = req.params;
  const { state } = req.body;

  if (state === undefined) {
    return next(new AppError('State is required', 400));
  }

  const whiteboard = await prisma.whiteboard.update({
    where: { projectId },
    data: { state }
  });

  res.status(200).json({
    status: 'success',
    data: {
      whiteboard
    }
  });
});
