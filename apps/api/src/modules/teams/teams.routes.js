import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as teamController from './teams.controllers.js';

const router = Router();

router.use(requireAuth);

router.post('/', teamController.createTeam);
router.get('/', teamController.getUserTeams);
router.get('/:id', teamController.getTeam);
router.post('/:id/members', teamController.addMember);
router.delete('/:id/members/:userId', teamController.removeMember);
router.delete('/:id', teamController.deleteTeam);

export default router;
