import { AIService } from './ai.service.js';
import { AgentService } from './agent.service.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';

export const handleAIChat = catchAsync(async (req, res, next) => {
  const { message, activeFile, selection, projectFiles, history } = req.body;

  if (!message) {
    return next(new AppError('Message is required', 400));
  }

  const response = await AIService.chat({
    message,
    activeFile,
    selection,
    projectFiles,
    history
  });

  res.status(200).json({
    status: 'success',
    data: { response }
  });
});

export const handleExplainCode = catchAsync(async (req, res, next) => {
  const { code, fileName, language } = req.body;

  if (!code) {
    return next(new AppError('Code is required for explanation', 400));
  }

  const response = await AIService.explain({ code, fileName, language });

  res.status(200).json({
    status: 'success',
    data: { response }
  });
});

export const handleRefactorCode = catchAsync(async (req, res, next) => {
  const { code, fileName, language, instruction } = req.body;

  if (!code) {
    return next(new AppError('Code is required for refactoring', 400));
  }

  const response = await AIService.refactor({ code, fileName, language, instruction });

  res.status(200).json({
    status: 'success',
    data: { response }
  });
});

export const handleGenerateTests = catchAsync(async (req, res, next) => {
  const { code, fileName, language } = req.body;

  if (!code) {
    return next(new AppError('Code is required to generate tests', 400));
  }

  const response = await AIService.generateTests({ code, fileName, language });

  res.status(200).json({
    status: 'success',
    data: { response }
  });
});

export const handleDetectBugs = catchAsync(async (req, res, next) => {
  const { code, fileName, language } = req.body;

  if (!code) {
    return next(new AppError('Code is required to detect bugs', 400));
  }

  const response = await AIService.detectBugs({ code, fileName, language });

  res.status(200).json({
    status: 'success',
    data: { response }
  });
});

export const handleSummarizeSession = catchAsync(async (req, res, next) => {
  const { activities, files, roomName } = req.body;

  const response = await AIService.summarizeSession({ activities, files, roomName });

  res.status(200).json({
    status: 'success',
    data: { response }
  });
});

export const handleGenerateCommitMessage = catchAsync(async (req, res, next) => {
  const { files, diffSummary } = req.body;

  const response = await AIService.generateCommitMessage({ files, diffSummary });

  res.status(200).json({
    status: 'success',
    data: { commitMessage: response }
  });
});

export const handleAgentStream = async (req, res) => {
  const { projectId, prompt, activeFile, selectedCode, contextFiles, history } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      console.error('SSE send error:', e);
    }
  };

  try {
    await AgentService.runAgentSession({
      projectId: projectId || null,
      userPrompt: prompt,
      activeFile,
      selectedCode,
      contextFiles,
      history,
      onEvent: sendEvent
    });
  } catch (error) {
    console.error('Agent stream error:', error);
    sendEvent({ type: 'error', message: error.message });
  } finally {
    try {
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (e) {}
  }
};
