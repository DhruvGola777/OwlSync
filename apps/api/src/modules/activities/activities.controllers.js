import { PrismaClient } from '@prisma/client';
import AppError from '../../utils/AppError.js';
import catchAsync from '../../utils/catchAsync.js';

const prisma = new PrismaClient();

export const getActivities = catchAsync(async (req, res, next) => {
  const { projectId } = req.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  const activities = await prisma.activity.findMany({
    where: { projectId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50 // Limit to latest 50 for now
  });

  res.status(200).json({
    status: 'success',
    data: { activities }
  });
});

export const createActivity = catchAsync(async (req, res, next) => {
  const { projectId } = req.params;
  const { type, description, metadata } = req.body;
  const userId = req.user.id;

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    return next(new AppError('Project not found', 404));
  }

  const activity = await prisma.activity.create({
    data: {
      projectId,
      userId,
      type,
      description,
      metadata: metadata || {}
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true
        }
      }
    }
  });

  res.status(201).json({
    status: 'success',
    data: { activity }
  });
});
