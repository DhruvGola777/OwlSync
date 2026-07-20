import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import * as otplib from 'otplib';
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

const prisma = new PrismaClient();
const JWT_SECRET = env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_EXPIRES_DAYS = env.REFRESH_TOKEN_EXPIRES_DAYS;

const createAccessToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
const createRefreshToken = () => crypto.randomBytes(48).toString('hex');
const calculateRefreshTokenExpiry = () => new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

export const signAccessToken = (userId) => createAccessToken(userId);

export const findUserByEmail = async (email) =>
  prisma.user.findUnique({ where: { email } });

export const generateUniqueUsername = async (email) => {
  let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!baseUsername) baseUsername = 'user';

  let username = baseUsername;
  let exists = await prisma.user.findUnique({ where: { username } });
  
  while (exists) {
    const randomSuffix = crypto.randomBytes(2).toString('hex');
    username = `${baseUsername}_${randomSuffix}`;
    exists = await prisma.user.findUnique({ where: { username } });
  }
  return username;
};

export const createUser = async ({ email, passwordHash, name, username }) => {
  const finalUsername = username || await generateUniqueUsername(email);
  return prisma.user.create({
    data: {
      email,
      username: finalUsername,
      password: passwordHash,
      name,
    },
  });
};

export const createSession = async ({ userId, userAgent, ipAddress }) => {
  const refreshToken = createRefreshToken();
  const expiresAt = calculateRefreshTokenExpiry();

  const session = await prisma.deviceSession.create({
    data: {
      userId,
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  return {
    accessToken: createAccessToken(userId),
    refreshToken,
    session,
  };
};

export const rotateSession = async ({ sessionId, userAgent, ipAddress }) => {
  const refreshToken = createRefreshToken();
  const updatedSession = await prisma.deviceSession.update({
    where: { id: sessionId },
    data: {
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt: calculateRefreshTokenExpiry(),
    },
  });

  return {
    accessToken: createAccessToken(updatedSession.userId),
    refreshToken,
    session: updatedSession,
  };
};

export const findSessionByRefreshToken = async (refreshToken) => {
  if (!refreshToken) return null;
  return prisma.deviceSession.findUnique({
    where: { refreshToken },
    include: { user: true },
  });
};

export const revokeSessionByToken = async (refreshToken) =>
  prisma.deviceSession.deleteMany({ where: { refreshToken } });

export const revokeSessionById = async (sessionId) =>
  prisma.deviceSession.deleteMany({ where: { id: sessionId } });

export const findUserById = async (userId) =>
  prisma.user.findUnique({ where: { id: userId } });

export const findOrCreateOAuthUser = async ({ provider, providerAccountId, email, name, avatarUrl }) => {
  if (!['google', 'github'].includes(provider)) {
    throw new Error('Unsupported OAuth provider');
  }

  let account = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
    include: { user: true },
  });

  if (account) {
    return { user: account.user, isNewUser: false };
  }

  let user = await prisma.user.findUnique({ where: { email } });
  let isNewUser = false;

  if (!user) {
    const generatedUsername = await generateUniqueUsername(email);
    user = await prisma.user.create({
      data: {
        email,
        username: generatedUsername,
        name,
        avatarUrl,
        isEmailVerified: true,
      },
    });
    isNewUser = true;
  } else if (!user.avatarUrl && avatarUrl) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl }
    });
  }

  await prisma.oAuthAccount.create({
    data: {
      provider,
      providerAccountId,
      userId: user.id,
    },
  });

  return { user, isNewUser };
};

export const userResponsePayload = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  name: user.name || null,
  avatarUrl: user.avatarUrl || null,
  isEmailVerified: user.isEmailVerified || false,
  isTwoFactorEnabled: user.isTwoFactorEnabled || false,
});

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

// --- Email Service (Ethereal for dev) ---
let etherealTransporter;

const getTransporter = async () => {
  if (etherealTransporter) return etherealTransporter;
  let testAccount = await nodemailer.createTestAccount();
  etherealTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  return etherealTransporter;
};

export const sendEmail = async (to, subject, html) => {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: '"OwlSync Auth" <auth@owlsync.com>',
    to,
    subject,
    html,
  });
  console.log(`\n📧 Email sent to ${to}: ${subject}`);
  console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}\n`);
};

// --- Verification Tokens (Magic Link & Password Reset) ---
export const generateVerificationToken = async (identifier, type) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  // Remove existing tokens of the same type for this identifier
  await prisma.verificationToken.deleteMany({
    where: { identifier, type }
  });

  return prisma.verificationToken.create({
    data: {
      identifier,
      token,
      type,
      expiresAt
    }
  });
};

export const verifyVerificationToken = async (token, type) => {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token }
  });

  if (!verificationToken || verificationToken.type !== type || verificationToken.expiresAt < new Date()) {
    return null;
  }

  // Delete the token once used
  await prisma.verificationToken.delete({
    where: { id: verificationToken.id }
  });

  return verificationToken;
};

// --- 2FA Functions ---
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

export const updatePassword = async (userId, passwordHash) => {
  return prisma.user.update({
    where: { id: userId },
    data: { password: passwordHash }
  });
};

export const verifyUserEmail = async (userId) => {
  return prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true }
  });
};

export const deleteUser = async (userId) => {
  return prisma.user.delete({
    where: { id: userId }
  });
};
