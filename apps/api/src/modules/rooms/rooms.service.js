import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import AppError from '../../utils/AppError.js';

const prisma = new PrismaClient();

export const createRoom = async ({ name, description, password, ownerId }) => {
  let hashedPassword = null;
  if (password) {
    hashedPassword = await bcryptjs.hash(password, 10);
  }

  return prisma.room.create({
    data: {
      name,
      description,
      password: hashedPassword,
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: 'OWNER'
        }
      }
    },
    include: {
      owner: {
        select: { id: true, username: true, name: true, avatarUrl: true }
      },
      _count: {
        select: { members: true }
      }
    }
  });
};

export const getRooms = async () => {
  // Return all rooms for Phase 1. 
  // We attach a boolean flag indicating if it's password protected.
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      password: true, // We will map this to a boolean before returning
      owner: { select: { id: true, username: true, name: true, avatarUrl: true } },
      _count: { select: { members: true } },
    }
  });

  return rooms.map(room => ({
    ...room,
    isProtected: !!room.password,
    password: undefined // Don't send hash to client
  }));
};

export const getRoomById = async (roomId) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      owner: { select: { id: true, username: true, name: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, username: true, name: true, avatarUrl: true, status: true } }
        }
      }
    }
  });

  if (room) {
    room.isProtected = !!room.password;
    room.password = undefined;
  }
  return room;
};

export const joinRoom = async ({ roomId, userId, password }) => {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  
  if (!room) {
    throw new AppError('Room not found', 404);
  }

  // Check if already a member
  const existingMember = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: { roomId, userId }
    }
  });

  if (existingMember) {
    return { message: 'Already joined', member: existingMember };
  }

  // Validate password if room is private
  if (room.password) {
    if (!password) {
      throw new AppError('This room requires a password', 401);
    }
    const isValid = await bcryptjs.compare(password, room.password);
    if (!isValid) {
      throw new AppError('Incorrect password', 401);
    }
  }

  const member = await prisma.roomMember.create({
    data: {
      roomId,
      userId,
      role: 'MEMBER'
    }
  });

  return { message: 'Successfully joined the room', member };
};

export const leaveRoom = async (roomId, userId) => {
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } }
  });

  if (!member) {
    throw new AppError('You are not a member of this room', 400);
  }

  if (member.role === 'OWNER') {
    throw new AppError('The owner cannot leave the room. You must delete the room instead.', 400);
  }

  return prisma.roomMember.delete({
    where: { id: member.id }
  });
};

export const removeMember = async (roomId, targetUserId, requesterUserId) => {
  const requester = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: requesterUserId } }
  });

  if (!requester || requester.role !== 'OWNER') {
    throw new AppError('Only the room owner can remove members', 403);
  }

  if (requesterUserId === targetUserId) {
    throw new AppError('You cannot kick yourself', 400);
  }

  return prisma.roomMember.delete({
    where: { roomId_userId: { roomId, userId: targetUserId } }
  });
};

export const deleteRoom = async (roomId, userId) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId }
  });

  if (!room) {
    throw new AppError('Room not found', 404);
  }

  if (room.ownerId !== userId) {
    throw new AppError('Only the room owner can delete the room', 403);
  }

  return prisma.room.delete({
    where: { id: roomId }
  });
};

export const getRoomMessages = async (roomId, userId) => {
  // Verify member
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } }
  });

  if (!member) {
    throw new AppError('You are not a member of this room', 403);
  }

  return prisma.message.findMany({
    where: { roomId },
    include: {
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 100 // Limit to last 100 messages for MVP
  });
};
