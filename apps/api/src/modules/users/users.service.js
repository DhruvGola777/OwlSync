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
