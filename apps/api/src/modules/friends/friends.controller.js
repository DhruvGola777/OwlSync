import * as friendsService from './friends.service.js';

export const sendFriendRequest = async (req, res, next) => {
  try {
    const { username } = req.body;
    const request = await friendsService.sendFriendRequest(req.user.id, username);
    res.status(201).json({ message: 'Friend request sent', request });
  } catch (err) {
    next(err);
  }
};

export const acceptRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await friendsService.acceptRequest(req.user.id, id);
    res.status(200).json({ message: 'Friend request accepted', request });
  } catch (err) {
    next(err);
  }
};

export const declineRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await friendsService.declineRequest(req.user.id, id);
    res.status(200).json({ message: 'Friend request declined', request });
  } catch (err) {
    next(err);
  }
};

export const getFriends = async (req, res, next) => {
  try {
    const friends = await friendsService.getFriends(req.user.id);
    res.status(200).json({ friends });
  } catch (err) {
    next(err);
  }
};

export const getPendingRequests = async (req, res, next) => {
  try {
    const requests = await friendsService.getPendingRequests(req.user.id);
    res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
};
