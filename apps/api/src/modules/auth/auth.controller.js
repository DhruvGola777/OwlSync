import bcrypt from 'bcryptjs';
import qrcode from 'qrcode';
import AppError from '../../utils/AppError.js';
import { env } from '../../config/env.js';
import {
  createSession,
  createUser,
  findUserByEmail,
  findSessionByRefreshToken,
  revokeSessionByToken,
  rotateSession,
  findOrCreateOAuthUser,
  userResponsePayload,
  getUserSessions,
  revokeSessionById,
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  updateUserTwoFactor,
  generateVerificationToken,
  verifyVerificationToken,
  sendEmail,
  updatePassword,
  verifyUserEmail,
  deleteUser
} from './auth.service.js';

const ACCESS_TOKEN_COOKIE = 'token';
const REFRESH_TOKEN_COOKIE = 'refreshToken';
const SESSION_COOKIE_LIFETIME = 30 * 24 * 60 * 60 * 1000; // 30 days

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: SESSION_COOKIE_LIFETIME,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions);
};

export const register = async (req, res, next) => {
  try {
    const { email, password, name, username } = req.body;
    if (!email || !password) throw new AppError('Email and password are required', 400);

    const existingUser = await findUserByEmail(email);
    if (existingUser) throw new AppError('User already exists', 400);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash, name, username });
    
    // Send a verification email instead of instant login
    const { token } = await generateVerificationToken(email, 'EMAIL_VERIFICATION');
    const link = `http://localhost:4000/api/auth/verify-email?token=${token}`;
    
    const welcomeHtml = `
      <h1>Welcome to OwlSync, ${name || 'there'}!</h1>
      <p>We are absolutely thrilled to have you on board.</p>
      <p>Please verify your email address by clicking <a href="${link}">here</a>.</p>
    `;
    sendEmail(email, 'Verify your email - OwlSync', welcomeHtml).catch(console.error);

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: userResponsePayload(user),
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError('Email and password are required', 400);

    const user = await findUserByEmail(email);
    if (!user || !user.password) throw new AppError('Invalid credentials', 401);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new AppError('Invalid credentials', 401);

    if (!user.isEmailVerified) {
      throw new AppError('Please verify your email before logging in. Check your inbox.', 403);
    }

    if (user.isTwoFactorEnabled) {
      return res.status(200).json({
        message: '2FA required',
        requiresTwoFactor: true,
        email: user.email,
      });
    }

    const session = await createSession({
      userId: user.id,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    setAuthCookies(res, session.accessToken, session.refreshToken);

    res.status(200).json({
      message: 'Login successful',
      user: userResponsePayload(user),
    });
  } catch (err) {
    next(err);
  }
};

export const refreshSession = async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) throw new AppError('Refresh token missing', 401);

    const session = await findSessionByRefreshToken(refreshToken);
    if (!session || session.expiresAt < new Date()) {
      if (session) await revokeSessionByToken(refreshToken);
      clearAuthCookies(res);
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const rotated = await rotateSession({
      sessionId: session.id,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    setAuthCookies(res, rotated.accessToken, rotated.refreshToken);

    res.status(200).json({
      message: 'Session refreshed',
      user: userResponsePayload(session.user),
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];
    if (refreshToken) await revokeSessionByToken(refreshToken);

    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) throw new AppError('Token is required', 400);

    const verificationToken = await verifyVerificationToken(token, 'EMAIL_VERIFICATION');
    if (!verificationToken) throw new AppError('Invalid or expired verification link', 400);

    const user = await findUserByEmail(verificationToken.identifier);
    if (!user) throw new AppError('User not found', 404);

    await verifyUserEmail(user.id);
    
    // Redirect to frontend login with a success parameter
    res.redirect('http://localhost:5173/login?verified=true');
  } catch (err) {
    next(err);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    await deleteUser(req.user.id);
    clearAuthCookies(res);
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Sessions
export const getSessions = async (req, res, next) => {
  try {
    const sessions = await getUserSessions(req.user.id);
    res.status(200).json({ sessions });
  } catch (err) {
    next(err);
  }
};

export const revokeDeviceSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    await revokeSessionById(id);
    res.status(200).json({ message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
};

// 2FA
export const setupTwoFactor = async (req, res, next) => {
  try {
    const { secret, otpauthUrl } = generateTwoFactorSecret(req.user.email);
    await updateUserTwoFactor(req.user.id, false, secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);
    res.status(200).json({ secret, qrCodeUrl });
  } catch (err) {
    next(err);
  }
};

export const verifyTwoFactor = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!req.user.twoFactorSecret) throw new AppError('2FA not set up', 400);
    
    const isValid = await verifyTwoFactorToken(token, req.user.twoFactorSecret);
    if (!isValid) throw new AppError('Invalid 2FA code', 400);

    await updateUserTwoFactor(req.user.id, true, req.user.twoFactorSecret);
    res.status(200).json({ message: '2FA enabled successfully', user: userResponsePayload(req.user) });
  } catch (err) {
    next(err);
  }
};

export const loginTwoFactor = async (req, res, next) => {
  try {
    const { email, token } = req.body;
    const user = await findUserByEmail(email);
    
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new AppError('Invalid request', 400);
    }
    
    const isValid = await verifyTwoFactorToken(token, user.twoFactorSecret);
    if (!isValid) throw new AppError('Invalid 2FA code', 401);

    const session = await createSession({
      userId: user.id,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    setAuthCookies(res, session.accessToken, session.refreshToken);
    res.status(200).json({ message: 'Login successful', user: userResponsePayload(user) });
  } catch (err) {
    next(err);
  }
};

// Magic Link
export const requestMagicLink = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);
    if (!user) throw new AppError('User not found', 404);

    const { token } = await generateVerificationToken(email, 'MAGIC_LINK');
    const link = `http://localhost:5173/auth/magic-link?token=${token}`;
    
    await sendEmail(email, 'Your Magic Link', `<p>Click <a href="${link}">here</a> to login.</p>`);
    res.status(200).json({ message: 'Magic link sent' });
  } catch (err) {
    next(err);
  }
};

export const verifyMagicLink = async (req, res, next) => {
  try {
    const { token } = req.query;
    const verificationToken = await verifyVerificationToken(token, 'MAGIC_LINK');
    if (!verificationToken) throw new AppError('Invalid or expired magic link', 400);

    const user = await findUserByEmail(verificationToken.identifier);
    if (!user) throw new AppError('User not found', 404);

    const session = await createSession({
      userId: user.id,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    setAuthCookies(res, session.accessToken, session.refreshToken);
    res.status(200).json({ message: 'Login successful', user: userResponsePayload(user) });
  } catch (err) {
    next(err);
  }
};

// Password Reset
export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(200).json({ message: 'If an account exists, a reset link was sent' });
    }

    const { token } = await generateVerificationToken(email, 'PASSWORD_RESET');
    const link = `http://localhost:5173/auth/reset-password?token=${token}`;
    
    await sendEmail(email, 'Password Reset', `<p>Click <a href="${link}">here</a> to reset your password.</p>`);
    res.status(200).json({ message: 'If an account exists, a reset link was sent' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const verificationToken = await verifyVerificationToken(token, 'PASSWORD_RESET');
    if (!verificationToken) throw new AppError('Invalid or expired reset token', 400);

    const user = await findUserByEmail(verificationToken.identifier);
    if (!user) throw new AppError('User not found', 404);

    const passwordHash = await bcrypt.hash(password, 10);
    await updatePassword(user.id, passwordHash);

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

// OAuth redirect and callback
export const oauthRedirect = (req, res, next) => {
  try {
    const { provider } = req.params;
    
    if (provider === 'google') {
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=http://localhost:4000/api/auth/oauth/google/callback&response_type=code&scope=profile email`;
      return res.redirect(url);
    } else if (provider === 'github') {
      const url = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=http://localhost:4000/api/auth/oauth/github/callback&scope=user:email`;
      return res.redirect(url);
    }
    
    throw new AppError('Unsupported provider', 400);
  } catch (err) {
    next(err);
  }
};

export const oauthCallback = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { code } = req.query; 
    
    if (!code) throw new AppError('Authorization code missing', 400);

    let profile = {};

    if (provider === 'google') {
      // 1. Exchange code for access token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          code,
          redirect_uri: 'http://localhost:4000/api/auth/oauth/google/callback',
          grant_type: 'authorization_code'
        })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new AppError('Failed to exchange Google token', 400);

      // 2. Fetch user profile
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = await userRes.json();
      
      profile = {
        email: userData.email,
        providerAccountId: userData.id,
        name: userData.name,
        avatarUrl: userData.picture
      };

    } else if (provider === 'github') {
      // 1. Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: 'http://localhost:4000/api/auth/oauth/github/callback',
        })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new AppError('Failed to exchange GitHub token', 400);

      // 2. Fetch user profile
      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = await userRes.json();

      // GitHub emails might be private, so we have to fetch them separately
      let email = userData.email;
      if (!email) {
        const emailRes = await fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const emails = await emailRes.json();
        const primaryEmail = emails.find(e => e.primary) || emails[0];
        email = primaryEmail?.email;
      }

      if (!email) throw new AppError('No email found for GitHub account', 400);

      profile = {
        email: email,
        providerAccountId: userData.id.toString(),
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url
      };
    } else {
      throw new AppError('Unsupported provider', 400);
    }

    const user = await findOrCreateOAuthUser({ 
      provider, 
      providerAccountId: profile.providerAccountId, 
      email: profile.email, 
      name: profile.name,
      avatarUrl: profile.avatarUrl
    });
    
    const session = await createSession({
      userId: user.id,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    setAuthCookies(res, session.accessToken, session.refreshToken);
    res.redirect('http://localhost:5173/dashboard');
  } catch (err) {
    next(err);
  }
};
