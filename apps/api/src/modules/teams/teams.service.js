import { PrismaClient } from '@prisma/client';
import AppError from '../../utils/AppError.js';
import { createNotification } from '../notifications/notifications.service.js';

const prisma = new PrismaClient();

export const createTeam = async (userId, { name, description }) => {
  if (!name || !name.trim()) {
    throw new AppError('Team name is required', 400);
  }

  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        name: name.trim(),
        description: description?.trim() || '',
        slug,
        ownerId: userId
      }
    });

    await tx.teamMember.create({
      data: {
        teamId: team.id,
        userId,
        role: 'OWNER'
      }
    });

    return team;
  });
};

export const getUserTeams = async (userId) => {
  return prisma.team.findMany({
    where: {
      members: {
        some: { userId }
      }
    },
    include: {
      owner: {
        select: { id: true, username: true, name: true, avatarUrl: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true, status: true }
          }
        }
      },
      projects: {
        select: { id: true, name: true, description: true, updatedAt: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
};

export const getTeamById = async (teamId, userId) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: {
        select: { id: true, username: true, name: true, avatarUrl: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true, status: true, bio: true }
          }
        }
      },
      projects: {
        include: {
          files: { select: { id: true, name: true } }
        },
        orderBy: { updatedAt: 'desc' }
      }
    }
  });

  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const isMember = team.members.some(m => m.userId === userId);
  if (!isMember) {
    throw new AppError('You are not a member of this team', 403);
  }

  return team;
};

export const addTeamMember = async (teamId, requesterId, targetUsername, role = 'MEMBER') => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true }
  });

  if (!team) throw new AppError('Team not found', 404);

  // Verify requester is OWNER or ADMIN
  const requesterMember = team.members.find(m => m.userId === requesterId);
  if (!requesterMember || (requesterMember.role !== 'OWNER' && requesterMember.role !== 'ADMIN')) {
    throw new AppError('Only team owners or admins can invite new members', 403);
  }

  const targetUser = await prisma.user.findUnique({
    where: { username: targetUsername }
  });

  if (!targetUser) throw new AppError(`User "@${targetUsername}" not found`, 404);

  const existingMember = team.members.find(m => m.userId === targetUser.id);
  if (existingMember) throw new AppError('User is already in this team', 400);

  const newMember = await prisma.teamMember.create({
    data: {
      teamId,
      userId: targetUser.id,
      role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER'
    },
    include: {
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true, status: true }
      }
    }
  });

  // Notify invited user
  await createNotification(targetUser.id, {
    type: 'TEAM_INVITE',
    title: 'Added to Team',
    message: `You were added to the team "${team.name}" by @${requesterMember.user?.username || 'admin'}.`,
    link: '/teams'
  });

  return newMember;
};

export const removeTeamMember = async (teamId, requesterId, targetUserId) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true }
  });

  if (!team) throw new AppError('Team not found', 404);

  if (targetUserId === team.ownerId) {
    throw new AppError('The team owner cannot be removed', 400);
  }

  // Self leave or admin removal
  const requesterMember = team.members.find(m => m.userId === requesterId);
  if (requesterId !== targetUserId && (!requesterMember || requesterMember.role !== 'OWNER')) {
    throw new AppError('Only the team owner can remove other members', 403);
  }

  await prisma.teamMember.deleteMany({
    where: { teamId, userId: targetUserId }
  });

  return { success: true };
};

export const deleteTeam = async (teamId, userId) => {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new AppError('Team not found', 404);
  if (team.ownerId !== userId) throw new AppError('Only the team owner can delete the team', 403);

  await prisma.team.delete({ where: { id: teamId } });
  return { success: true };
};
