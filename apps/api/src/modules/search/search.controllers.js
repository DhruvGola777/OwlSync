import catchAsync from '../../utils/catchAsync.js';
import * as searchService from './search.service.js';

export const globalSearch = catchAsync(async (req, res) => {
  const query = req.query.q || '';
  const currentUserId = req.user.id;

  const results = await searchService.performGlobalSearch(query, currentUserId);

  res.status(200).json({
    status: 'success',
    data: results
  });
});
