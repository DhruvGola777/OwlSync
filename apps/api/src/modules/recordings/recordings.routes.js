import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../../middlewares/requireAuth.js';
import {
  uploadRecording,
  getRecordings,
  getRecordingById,
  updateRecording,
  deleteRecording
} from './recordings.controllers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure recordings storage folder exists
const uploadDir = path.resolve(__dirname, '../../../storage/recordings');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `recording-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB max
  }
});

const router = express.Router();

router.use(requireAuth);

router.post('/upload', upload.single('file'), uploadRecording);
router.get('/', getRecordings);
router.get('/:id', getRecordingById);
router.patch('/:id', updateRecording);
router.delete('/:id', deleteRecording);

export default router;
