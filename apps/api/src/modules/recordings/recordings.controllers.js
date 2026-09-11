import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import { publishToQueue } from '../../config/rabbitmq.js';
import { trackEvent } from '../analytics/analytics.service.js';

const prisma = new PrismaClient();

// Upload a new recording
export const uploadRecording = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No recording file provided', 400));
  }

  const userId = req.user.id;
  const { title, description, duration, roomId, projectId } = req.body;

  const recordingTitle = title && title.trim().length > 0 
    ? title.trim() 
    : `Session Recording - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const durationSec = duration ? parseInt(duration, 10) : 0;
  const fileSize = req.file.size;
  const relativeFilePath = `/uploads/recordings/${req.file.filename}`;

  const recording = await prisma.recording.create({
    data: {
      title: recordingTitle,
      description: description || null,
      filePath: req.file.path,
      url: relativeFilePath,
      duration: isNaN(durationSec) ? 0 : durationSec,
      size: fileSize,
      mimeType: req.file.mimetype || 'video/webm',
      userId,
      roomId: roomId || null,
      projectId: projectId || null,
    },
    include: {
      user: {
        select: { id: true, name: true, username: true, avatarUrl: true }
      }
    }
  });

  // Asynchronously generate video thumbnail via RabbitMQ
  publishToQueue('thumbnail_queue', {
    recordingId: recording.id,
    filePath: recording.filePath
  });

  // Track telemetry event
  trackEvent('RECORDING_UPLOAD', {
    userId,
    roomId: roomId || null,
    metadata: { recordingId: recording.id, duration: durationSec, size: fileSize }
  });

  res.status(201).json({
    status: 'success',
    data: { recording }
  });
});

// Get all recordings for the current user (with search & filtering)
export const getRecordings = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { q, roomId, projectId } = req.query;

  const whereClause = {
    userId,
  };

  if (q && q.trim()) {
    whereClause.title = {
      contains: q.trim(),
      mode: 'insensitive'
    };
  }

  if (roomId) whereClause.roomId = roomId;
  if (projectId) whereClause.projectId = projectId;

  const recordings = await prisma.recording.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, name: true, username: true, avatarUrl: true }
      }
    }
  });

  res.status(200).json({
    status: 'success',
    results: recordings.length,
    data: { recordings }
  });
});

// Get single recording by ID
export const getRecordingById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  const recording = await prisma.recording.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, username: true, avatarUrl: true }
      }
    }
  });

  if (!recording) {
    return next(new AppError('Recording not found', 404));
  }

  // Allow access if owner
  if (recording.userId !== userId) {
    return next(new AppError('You do not have permission to access this recording', 403));
  }

  res.status(200).json({
    status: 'success',
    data: { recording }
  });
});

// Update recording metadata (title, description)
export const updateRecording = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { title, description } = req.body;

  const existing = await prisma.recording.findUnique({ where: { id } });
  if (!existing) {
    return next(new AppError('Recording not found', 404));
  }

  if (existing.userId !== userId) {
    return next(new AppError('You do not have permission to edit this recording', 403));
  }

  const updated = await prisma.recording.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() })
    },
    include: {
      user: {
        select: { id: true, name: true, username: true, avatarUrl: true }
      }
    }
  });

  res.status(200).json({
    status: 'success',
    data: { recording: updated }
  });
});

// Delete recording from database and storage
export const deleteRecording = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  const existing = await prisma.recording.findUnique({ where: { id } });
  if (!existing) {
    return next(new AppError('Recording not found', 404));
  }

  if (existing.userId !== userId) {
    return next(new AppError('You do not have permission to delete this recording', 403));
  }

  // Remove file from disk if it exists
  if (existing.filePath && fs.existsSync(existing.filePath)) {
    try {
      fs.unlinkSync(existing.filePath);
    } catch (err) {
      console.warn('Could not delete physical recording file:', err.message);
    }
  }

  await prisma.recording.delete({ where: { id } });

  res.status(204).json({
    status: 'success',
    data: null
  });
});
