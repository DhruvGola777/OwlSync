import * as roomService from './rooms.service.js';

export const createRoom = async (req, res, next) => {
  try {
    const { name, description, password } = req.body;
    const room = await roomService.createRoom({
      name,
      description,
      password,
      ownerId: req.user.id
    });
    res.status(201).json({ message: 'Room created successfully', room });
  } catch (err) {
    next(err);
  }
};

export const getRooms = async (req, res, next) => {
  try {
    const rooms = await roomService.getRooms();
    res.status(200).json({ rooms });
  } catch (err) {
    next(err);
  }
};

export const getRoomById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await roomService.getRoomById(id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.status(200).json({ room });
  } catch (err) {
    next(err);
  }
};

export const joinRoom = async (req, res, next) => {
  try {
    // The frontend currently posts { roomId, password } to /join (or /:id/join)
    // We support req.body.roomId or req.params.id based on the route
    const roomId = req.body.roomId || req.params.id;
    const { password } = req.body;
    
    const result = await roomService.joinRoom({
      roomId,
      userId: req.user.id,
      password
    });
    
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const leaveRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    await roomService.leaveRoom(id, req.user.id);
    res.status(200).json({ message: 'Left room successfully' });
  } catch (err) {
    next(err);
  }
};

export const kickMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    await roomService.removeMember(id, userId, req.user.id);
    res.status(200).json({ message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
};

export const deleteRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    await roomService.deleteRoom(id, req.user.id);
    res.status(200).json({ message: 'Room deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const getRoomMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const messages = await roomService.getRoomMessages(id, req.user.id);
    res.status(200).json({ messages });
  } catch (err) {
    next(err);
  }
};
