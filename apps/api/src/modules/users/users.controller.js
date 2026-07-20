import qrcode from 'qrcode';
import AppError from '../../utils/AppError.js';
import {
  updateProfile,
  getUserSessions,
  revokeSessionById,
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  updateUserTwoFactor,
  deleteUser
} from './users.service.js';

export const getMe = async (req, res, next) => {
  try {
    const payload = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      name: req.user.name || null,
      avatarUrl: req.user.avatarUrl || null,
      isEmailVerified: req.user.isEmailVerified || false,
      isTwoFactorEnabled: req.user.isTwoFactorEnabled || false,
    };
    res.status(200).json({ user: payload });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const { name, username } = req.body;
    const updatedUser = await updateProfile(req.user.id, { name, username });
    res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err) {
    next(err);
  }
};

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
    res.status(200).json({ message: '2FA enabled successfully' });
  } catch (err) {
    next(err);
  }
};

export const disableTwoFactor = async (req, res, next) => {
  try {
    await updateUserTwoFactor(req.user.id, false, null);
    res.status(200).json({ message: '2FA disabled successfully' });
  } catch (err) {
    next(err);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    await deleteUser(req.user.id);
    res.clearCookie('token', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
};
