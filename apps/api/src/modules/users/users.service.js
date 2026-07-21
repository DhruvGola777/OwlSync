import { PrismaClient } from '@prisma/client';
import * as otplib from 'otplib';

const prisma = new PrismaClient();

export const updateProfile = async (userId, data) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...data,
      status: 'ONLINE',
      lastSeen: new Date()
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      avatarUrl: true,
      bio: true,
      status: true,
      lastSeen: true,
      isEmailVerified: true,
      isTwoFactorEnabled: true,
    }
  });
};

export const getUserSessions = async (userId) => {
  return prisma.deviceSession.findMany({
    where: { userId },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      expiresAt: true
    }
  });
};

export const revokeSessionById = async (sessionId) =>
  prisma.deviceSession.deleteMany({ where: { id: sessionId } });

export const generateTwoFactorSecret = (email) => {
  const secret = otplib.generateSecret();
  const otpauthUrl = `otpauth://totp/OwlSync:${encodeURIComponent(email)}?secret=${secret}&issuer=OwlSync`;
  return { secret, otpauthUrl };
};

export const verifyTwoFactorToken = async (token, secret) => {
  return await otplib.verify({ token, secret });
};

export const updateUserTwoFactor = async (userId, isEnabled, secret = null) => {
  return prisma.user.update({
    where: { id: userId },
    data: {
      isTwoFactorEnabled: isEnabled,
      twoFactorSecret: secret,
    },
  });
};

export const deleteUser = async (userId) => {
  return prisma.user.delete({
    where: { id: userId }
  });
};

export const searchUsers = async (query, excludeUserId) => {
  return prisma.user.findMany({
    where: {
      username: { contains: query, mode: 'insensitive' },
      id: { not: excludeUserId }
    },
    select: { username: true, name: true, avatarUrl: true },
    take: 5
  });
};

export const getUserProfile = async (username, currentUserId) => {
  const targetUser = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
      bio: true,
      status: true,
      lastSeen: true
    }
  });

  if (!targetUser) return null;

  let relationship = 'NONE';
  let requestId = null;
  let mutualFriends = [];

  if (targetUser.id === currentUserId) {
    relationship = 'SELF';
  } else {
    // Check for block
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: targetUser.id },
          { blockerId: targetUser.id, blockedId: currentUserId }
        ]
      }
    });

    if (block) {
      if (block.blockerId === targetUser.id) {
        // Target blocked current user -> Unavailable
        return null; 
      } else {
        // Current user blocked target
        relationship = 'BLOCKED';
      }
    } else {
      // Check for friend request
      const request = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: targetUser.id },
            { senderId: targetUser.id, receiverId: currentUserId }
          ]
        }
      });

      if (request) {
        requestId = request.id;
        if (request.status === 'ACCEPTED') {
          relationship = 'FRIENDS';
        } else if (request.status === 'PENDING') {
          if (request.senderId === currentUserId) {
            relationship = 'PENDING_OUTGOING';
          } else {
            relationship = 'PENDING_INCOMING';
          }
        }
      }
    }

    // Mutual Friends Calculation
    if (relationship !== 'BLOCKED') {
      const myFriendsReqs = await prisma.friendRequest.findMany({
        where: {
          OR: [{ senderId: currentUserId }, { receiverId: currentUserId }],
          status: 'ACCEPTED'
        }
      });
      const myFriendsIds = myFriendsReqs.map(r => r.senderId === currentUserId ? r.receiverId : r.senderId);

      const theirFriendsReqs = await prisma.friendRequest.findMany({
        where: {
          OR: [{ senderId: targetUser.id }, { receiverId: targetUser.id }],
          status: 'ACCEPTED'
        }
      });
      const theirFriendsIds = theirFriendsReqs.map(r => r.senderId === targetUser.id ? r.receiverId : r.senderId);

      const mutualIds = myFriendsIds.filter(id => theirFriendsIds.includes(id));
      
      if (mutualIds.length > 0) {
        mutualFriends = await prisma.user.findMany({
          where: { id: { in: mutualIds } },
          select: { id: true, username: true, name: true, avatarUrl: true }
        });
      }
    }
  }

  return { ...targetUser, relationship, requestId, mutualFriends };
};

export const blockUser = async (currentUserId, targetUserId) => {
  // Delete any existing friendship/request
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId }
      ]
    }
  });

  return prisma.block.create({
    data: {
      blockerId: currentUserId,
      blockedId: targetUserId
    }
  });
};

export const unblockUser = async (currentUserId, targetUserId) => {
  return prisma.block.deleteMany({
    where: {
      blockerId: currentUserId,
      blockedId: targetUserId
    }
  });
};

