import express from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import {
  handleAIChat,
  handleExplainCode,
  handleRefactorCode,
  handleGenerateTests,
  handleDetectBugs,
  handleSummarizeSession,
  handleGenerateCommitMessage,
  handleAgentStream
} from './ai.controller.js';

const router = express.Router();

// Protect all AI routes
router.use(requireAuth);

router.post('/agent/stream', handleAgentStream);
router.post('/chat', handleAIChat);
router.post('/explain', handleExplainCode);
router.post('/refactor', handleRefactorCode);
router.post('/generate-tests', handleGenerateTests);
router.post('/detect-bugs', handleDetectBugs);
router.post('/summarize-session', handleSummarizeSession);
router.post('/commit-message', handleGenerateCommitMessage);

export default router;
