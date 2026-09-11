import express from 'express';
import multer from 'multer';
import { requireAuth } from '../../middlewares/requireAuth.js';
import * as projectsController from './projects.controllers.js';

const uploadZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const router = express.Router();

// Apply auth middleware to all project routes
router.use(requireAuth);

router.post('/', projectsController.createProject);
router.post('/import/zip', uploadZip.single('file'), projectsController.importProjectZip);
router.post('/import/folder', projectsController.importProjectFolder);
router.get('/', projectsController.getProjects);
router.get('/:id', projectsController.getProject);
router.get('/:id/export', projectsController.exportProject);

// File management within a project
router.post('/:id/files', projectsController.createFile);
router.put('/:id/files/rename', projectsController.renameFileOrFolder);
router.delete('/:id/files', projectsController.deleteFileOrFolder);
router.put('/:id/files/:fileId', projectsController.updateFile);
// We keep the old delete file endpoint just in case it's still used somewhere by ID
router.delete('/:id/files/:fileId', projectsController.deleteFileOrFolder);

import notesRouter from '../notes/notes.routes.js';
router.use('/:id/notes', notesRouter);

import whiteboardRouter from '../whiteboard/whiteboard.routes.js';
router.use('/:id/whiteboard', whiteboardRouter);

import activitiesRouter from '../activities/activities.routes.js';
router.use('/:projectId/activities', activitiesRouter);

export default router;
