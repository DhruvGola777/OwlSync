import { PrismaClient } from '@prisma/client';
import AppError from '../../utils/AppError.js';

const prisma = new PrismaClient();

export const sendFriendRequest = async (senderId, targetUsername) => {
  if (!targetUsername) throw new AppError('Username is required', 400);

  const targetUser = await prisma.user.findUnique({
    where: { username: targetUsername }
  });

  if (!targetUser) {
    throw new AppError('User not found', 404);
  }

  if (targetUser.id === senderId) {
    throw new AppError('You cannot send a friend request to yourself', 400);
  }

  // Check if either user has blocked the other
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: senderId, blockedId: targetUser.id },
        { blockerId: targetUser.id, blockedId: senderId }
      ]
    }
  });

  if (block) {
    throw new AppError('Cannot send friend request to this user', 403);
  }

  // Check if a request already exists in either direction
  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId, receiverId: targetUser.id },
        { senderId: targetUser.id, receiverId: senderId }
      ]
    }
  });

  if (existingRequest) {
    if (existingRequest.status === 'PENDING') {
      throw new AppError('A pending request already exists', 400);
    }
    if (existingRequest.status === 'ACCEPTED') {
      throw new AppError('You are already friends', 400);
    }
    // If DECLINED, we allow sending a new one by updating the old one
    return prisma.friendRequest.update({
      where: { id: existingRequest.id },
      data: {
        status: 'PENDING',
        senderId,
        receiverId: targetUser.id
      }
    });
  }

  return prisma.friendRequest.create({
    data: {
      senderId,
      receiverId: targetUser.id,
      status: 'PENDING'
    }
  });
};

export const acceptRequest = async (userId, requestId) => {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  if (request.receiverId !== userId) {
    throw new AppError('You cannot accept this request', 403);
  }

  if (request.status !== 'PENDING') {
    throw new AppError(`Request is already ${request.status}`, 400);
  }

  return prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: 'ACCEPTED' }
  });
};

export const declineRequest = async (userId, requestId) => {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId }
  });

  if (!request) {
    throw new AppError('Request not found', 404);
  }

  if (request.receiverId !== userId) {
    throw new AppError('You cannot decline this request', 403);
  }

  return prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: 'DECLINED' }
  });
};

export const getFriends = async (userId) => {
  const requests = await prisma.friendRequest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: userId },
        { receiverId: userId }
      ]
    },
    include: {
      sender: { select: { id: true, username: true, name: true, avatarUrl: true, status: true, lastSeen: true } },
      receiver: { select: { id: true, username: true, name: true, avatarUrl: true, status: true, lastSeen: true } }
    }
  });

  // Extract the "other" user
  return requests.map(req => {
    const friend = req.senderId === userId ? req.receiver : req.sender;
    return {
      friendRequestId: req.id,
      ...friend
    };
  });
};

export const getPendingRequests = async (userId) => {
  const incoming = await prisma.friendRequest.findMany({
    where: { receiverId: userId, status: 'PENDING' },
    include: {
      sender: { select: { id: true, username: true, name: true, avatarUrl: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const outgoing = await prisma.friendRequest.findMany({
    where: { senderId: userId, status: 'PENDING' },
    include: {
      receiver: { select: { id: true, username: true, name: true, avatarUrl: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return { incoming, outgoing };
};
