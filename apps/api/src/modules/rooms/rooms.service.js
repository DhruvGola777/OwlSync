import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import AppError from '../../utils/AppError.js';
import { DistributedLockService } from '../../services/distributedLock.service.js';
import { CacheService } from '../../services/cache.service.js';

const prisma = new PrismaClient();

export const createRoom = async ({ name, description, password, ownerId, projectId }) => {
  return DistributedLockService.withLock(`room:create:${ownerId}`, 5000, async () => {
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcryptjs.hash(password, 10);
    }

    let finalProjectId = projectId;
    if (!finalProjectId) {
      const project = await prisma.project.create({
        data: {
          name: `${name} Project`,
          description: description || `Project environment for ${name}`,
          ownerId,
          files: {
            create: [
              {
                name: 'index.js',
                path: '/index.js',
                content: `// Welcome to ${name} on OwlSync!\nconsole.log("Hello from OwlSync Room!");\n`
              },
              {
                name: 'package.json',
                path: '/package.json',
                content: `{\n  "name": "${name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'owlsync-app'}",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  }\n}\n`
              },
              {
                name: 'README.md',
                path: '/README.md',
                content: `# ${name}\n\nCollaborative room project created on OwlSync.\n`
              }
            ]
          },
          whiteboard: {
            create: {
              state: ''
            }
          },
          note: {
            create: {
              content: `# Meeting Notes for ${name}\n\n- Discuss architecture\n- Pair program features\n`
            }
          }
        }
      });
      finalProjectId = project.id;
    }

    const createdRoom = await prisma.room.create({
      data: {
        name,
        description,
        password: hashedPassword,
        ownerId,
        projectId: finalProjectId,
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
        },
        project: {
          include: { files: true }
        }
      }
    });

    // Invalidate public room listing cache
    await CacheService.del('rooms:public:list');

    return createdRoom;
  });
};

export const getRooms = async () => {
  return CacheService.getOrSet('rooms:public:list', 30, async () => {
    const rooms = await prisma.room.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        password: true,
        owner: { select: { id: true, username: true, name: true, avatarUrl: true } },
        _count: { select: { members: true } },
      }
    });

    return rooms.map(room => ({
      ...room,
      isProtected: !!room.password,
      password: undefined
    }));
  });
};

export const getRoomById = async (roomId) => {
  let room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      owner: { select: { id: true, username: true, name: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, username: true, name: true, avatarUrl: true, status: true } }
        }
      },
      project: {
        include: { files: true }
      }
    }
  });

  if (room && (!room.projectId || !room.project)) {
    // Auto-heal existing room that lacks a project
    const project = await prisma.project.create({
      data: {
        name: `${room.name} Project`,
        description: room.description || `Project environment for ${room.name}`,
        ownerId: room.ownerId,
        files: {
          create: [
            {
              name: 'index.js',
              path: '/index.js',
              content: `// Welcome to ${room.name} on OwlSync!\nconsole.log("Hello from OwlSync Room!");\n`
            },
            {
              name: 'package.json',
              path: '/package.json',
              content: `{\n  "name": "${room.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'owlsync-app'}",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": {\n    "start": "node index.js"\n  }\n}\n`
            },
            {
              name: 'README.md',
              path: '/README.md',
              content: `# ${room.name}\n\nCollaborative room project created on OwlSync.\n`
            }
          ]
        },
        whiteboard: {
          create: {
            state: ''
          }
        },
        note: {
          create: {
            content: `# Meeting Notes for ${room.name}\n\n- Discuss architecture\n- Pair program features\n`
          }
        }
      },
      include: { files: true }
    });

    await prisma.room.update({
      where: { id: roomId },
      data: { projectId: project.id }
    });

    room.projectId = project.id;
    room.project = project;
  }

  if (room) {
    room.isProtected = !!room.password;
    room.password = undefined;
  }
  return room;
};

export const joinRoom = async ({ roomId, userId, password }) => {
  return DistributedLockService.withLock(`room:join:${roomId}:${userId}`, 4000, async () => {
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

    try {
      const member = await prisma.roomMember.create({
        data: {
          roomId,
          userId,
          role: 'MEMBER'
        }
      });
      return { message: 'Successfully joined the room', member };
    } catch (error) {
      if (error.code === 'P2002') {
        const existingMember = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } }
        });
        return { message: 'Already joined', member: existingMember };
      }
      throw error;
    }
  });
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

  const deleted = await prisma.room.delete({
    where: { id: roomId }
  });

  // Invalidate public room listing cache
  await CacheService.del('rooms:public:list');

  return deleted;
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
