import { PrismaClient } from '@prisma/client';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const prisma = new PrismaClient();

// Get note for a project
export const getNote = catchAsync(async (req, res, next) => {
  const { id: projectId } = req.params;

  // Find the project first to ensure it exists and user has access
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  // Find or create the note for this project
  let note = await prisma.note.findUnique({
    where: { projectId }
  });

  if (!note) {
    note = await prisma.note.create({
      data: {
        projectId,
        content: '# Project Notes\n\nWelcome to your shared notes. This document synchronizes in real-time.'
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      note
    }
  });
});

// Update note content (used as fallback or for final saves)
export const updateNote = catchAsync(async (req, res, next) => {
  const { id: projectId } = req.params;
  const { content } = req.body;

  if (content === undefined) {
    return next(new AppError('Content is required', 400));
  }

  const note = await prisma.note.update({
    where: { projectId },
    data: { content }
  });

  res.status(200).json({
    status: 'success',
    data: {
      note
    }
  });
});
