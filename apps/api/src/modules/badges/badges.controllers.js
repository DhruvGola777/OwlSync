import catchAsync from '../../utils/catchAsync.js';
import * as badgeService from './badges.service.js';

export const getBadges = catchAsync(async (req, res) => {
  const badges = await badgeService.getAllBadges();
  res.status(200).json({
    status: 'success',
    data: { badges }
  });
});

export const getUserBadges = catchAsync(async (req, res) => {
  const { username } = req.params;
  const badges = await badgeService.getUserBadges(username);
  res.status(200).json({
    status: 'success',
    data: { badges }
  });
});
