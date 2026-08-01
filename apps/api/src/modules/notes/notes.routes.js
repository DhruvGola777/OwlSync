import express from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as notesController from './notes.controllers.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', notesController.getNote);
router.put('/', notesController.updateNote);

export default router;
