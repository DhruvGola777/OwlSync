import { getUserAnalytics, getWorkspaceAnalytics } from './analytics.service.js';

export const getUserAnalyticsHandler = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const analytics = await getUserAnalytics(userId);
    res.status(200).json({
      status: 'success',
      data: { analytics }
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceAnalyticsHandler = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const analytics = await getWorkspaceAnalytics(workspaceId);
    res.status(200).json({
      status: 'success',
      data: { analytics }
    });
  } catch (error) {
    next(error);
  }
};
