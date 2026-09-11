import catchAsync from '../../utils/catchAsync.js';
import * as teamService from './teams.service.js';

export const createTeam = catchAsync(async (req, res) => {
  const team = await teamService.createTeam(req.user.id, req.body);
  res.status(201).json({
    status: 'success',
    data: { team }
  });
});

export const getUserTeams = catchAsync(async (req, res) => {
  const teams = await teamService.getUserTeams(req.user.id);
  res.status(200).json({
    status: 'success',
    data: { teams }
  });
});

export const getTeam = catchAsync(async (req, res) => {
  const team = await teamService.getTeamById(req.params.id, req.user.id);
  res.status(200).json({
    status: 'success',
    data: { team }
  });
});

export const addMember = catchAsync(async (req, res) => {
  const member = await teamService.addTeamMember(
    req.params.id,
    req.user.id,
    req.body.username,
    req.body.role
  );
  res.status(201).json({
    status: 'success',
    data: { member }
  });
});

export const removeMember = catchAsync(async (req, res) => {
  await teamService.removeTeamMember(
    req.params.id,
    req.user.id,
    req.params.userId
  );
  res.status(200).json({
    status: 'success',
    message: 'Team member removed'
  });
});

export const deleteTeam = catchAsync(async (req, res) => {
  await teamService.deleteTeam(req.params.id, req.user.id);
  res.status(200).json({
    status: 'success',
    message: 'Team deleted'
  });
});
