import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Sparkles, Send, Trash2, Copy, Check, Terminal, 
  FileCode, Wrench, Bug, GitCommit, Loader2, Play,
  FolderPlus, FileCheck, CheckCircle2, ChevronDown, ChevronRight,
  ArrowRightCircle, Cpu, GitCompare, Eye, X, RotateCcw,
  Paperclip, AtSign, FileText
} from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';

export const AIPanel = ({ 
  projectId, 
  roomName, 
  activeFile, 
  selectedCode, 
  projectFiles = [],
  pendingDiff,
  aiEditHistory = [],
  onRollback,
  onDiffProposed,
  onAcceptDiff,
  onRejectDiff,
  onInsertCode,
  onApplyCode,
  onFilesChanged
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 **Hi ${user?.name || 'there'}! I'm OwlSync AI Agent.**\n\nI'm your autonomous pair programmer with full terminal and codebase powers.\n\n- Type **\`@\`** to mention and attach any file from the workspace.\n- Every AI code edit has **live visual diff review** and **one-click rollback**.\n\nAsk me anything or use the action chips below!`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSteps, setActiveSteps] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [appliedId, setAppliedId] = useState(null);
  const [showStepsDetails, setShowStepsDetails] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0);
  const [rolledBackIds, setRolledBackIds] = useState(new Set());
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, activeSteps]);

  const filteredMentionFiles = (projectFiles || [])
    .filter(f => f && f.name && !f.name.endsWith('.keep'))
    .filter(f => {
      if (!mentionQuery) return true;
      const q = mentionQuery.toLowerCase();
      return (f.name && f.name.toLowerCase().includes(q)) || (f.path && f.path.toLowerCase().includes(q));
    })
    .slice(0, 8);

  const handleCopy = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApply = async (code, id, targetFilePath = null) => {
    if (onApplyCode) {
      await onApplyCode(code, targetFilePath || activeFile?.path);
      setAppliedId(id);
      setTimeout(() => setAppliedId(null), 2500);
    } else if (onInsertCode) {
      onInsertCode(code);
      setAppliedId(id);
      setTimeout(() => setAppliedId(null), 2500);
    }
  };

  const handleRollbackClick = async (historyOrDiff, msgId) => {
    if (!onRollback) return;
    const success = await onRollback(historyOrDiff);
    if (success) {
      setRolledBackIds(prev => new Set([...prev, msgId || historyOrDiff.id || historyOrDiff.fileId]));
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setInput(val);

    // Check if cursor is following an '@' character
    const textBeforeCursor = val.slice(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (/\s/.test(charBeforeAt)) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!/\s/.test(query)) {
          setMentionQuery(query);
          setMentionCursorPos(lastAtIndex);
          setShowMentionMenu(true);
          setSelectedMentionIdx(0);
          return;
        }
      }
    }
    setShowMentionMenu(false);
  };

  const handleSelectMention = (file) => {
    if (!file) return;
    const pos = textareaRef.current?.selectionStart || input.length;
    const textBeforeAt = input.slice(0, mentionCursorPos);
    const textAfterCursor = input.slice(pos);
    const filePathOrName = file.path || file.name;
    const updatedInput = `${textBeforeAt}@${filePathOrName} ${textAfterCursor}`;
    
    setInput(updatedInput);
    setShowMentionMenu(false);

    if (!attachedFiles.some(f => f.id === file.id || f.path === file.path)) {
      setAttachedFiles(prev => [...prev, file]);
    }

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = textBeforeAt.length + filePathOrName.length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  const handleRemoveAttachedFile = (fileToRemove) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileToRemove.id && f.path !== fileToRemove.path));
  };

  const handleSend = async (customPrompt = null, actionType = 'agent') => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend) return;

    // Gather all attached files + any @file mentions from prompt text
    const gatheredContextFiles = [...attachedFiles];
    const mentionRegex = /@([a-zA-Z0-9_\-./]+)/g;
    let match;
    while ((match = mentionRegex.exec(textToSend)) !== null) {
      const q = match[1].toLowerCase();
      const matched = projectFiles.find(f => 
        (f.path && f.path.toLowerCase().endsWith(q)) || 
        (f.name && f.name.toLowerCase() === q)
      );
      if (matched && !gatheredContextFiles.some(cf => cf.id === matched.id || cf.path === matched.path)) {
        gatheredContextFiles.push(matched);
      }
    }

    const contextFilesPayload = gatheredContextFiles.map(f => ({
      id: f.id,
      name: f.name,
      path: f.path,
      content: f.content || ''
    }));

    const userMessageId = Date.now().toString();
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
      contextTag: activeFile ? `${activeFile.name}${selectedCode ? ' (Selection)' : ''}` : null,
      contextFiles: contextFilesPayload.map(f => f.name || f.path)
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customPrompt) {
      setInput('');
      setAttachedFiles([]);
      setShowMentionMenu(false);
    }
    setLoading(true);
    setActiveSteps([]);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      steps: []
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Use Agent Streaming Session with real-time tool calling, steps & context files
      await api.streamAgentSession({
        projectId,
        prompt: textToSend,
        activeFile,
        selectedCode,
        contextFiles: contextFilesPayload,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        onEvent: (event) => {
          if (event.type === 'step') {
            setActiveSteps(prev => {
              const existingIndex = prev.findIndex(s => s.id === event.id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = { ...updated[existingIndex], ...event };
                return updated;
              }
              return [...prev, event];
            });

            // Update steps array in the active assistant message
            setMessages(prev => prev.map(m => {
              if (m.id === assistantMessageId) {
                const currentSteps = m.steps || [];
                const idx = currentSteps.findIndex(s => s.id === event.id);
                if (idx >= 0) {
                  const updated = [...currentSteps];
                  updated[idx] = { ...updated[idx], ...event };
                  return { ...m, steps: updated };
                }
                return { ...m, steps: [...currentSteps, event] };
              }
              return m;
            }));
          }

          if (event.type === 'token') {
            setMessages(prev => prev.map(m => {
              if (m.id === assistantMessageId) {
                return { ...m, content: m.content + event.text };
              }
              return m;
            }));
          }

          if (event.type === 'diff') {
            setMessages(prev => prev.map(m => {
              if (m.id === assistantMessageId) {
                return { ...m, diff: event };
              }
              return m;
            }));
            onDiffProposed?.(event);
            onFilesChanged?.();
          }

          if (event.type === 'file_created' || event.type === 'file_updated') {
            onFilesChanged?.();
          }

          if (event.type === 'error') {
            setMessages(prev => prev.map(m => {
              if (m.id === assistantMessageId) {
                return { 
                  ...m, 
                  content: m.content ? `${m.content}\n\n⚠️ *${event.message}*` : `⚠️ **Error:** ${event.message}`,
                  isError: true 
                };
              }
              return m;
            }));
          }
        },
        onError: (err) => {
          console.error('Agent error:', err);
          setMessages(prev => prev.map(m => {
            if (m.id === assistantMessageId) {
              return {
                ...m,
                content: m.content || `⚠️ **Execution Error:** ${err.message || 'Check connection or API keys.'}`,
                isError: true
              };
            }
            return m;
          }));
        },
        onComplete: () => {
          onFilesChanged?.();
          setLoading(false);
        }
      });

    } catch (err) {
      console.error('Agent error:', err);
      setMessages(prev => prev.map(m => {
        if (m.id === assistantMessageId) {
          return {
            ...m,
            content: `⚠️ **Agent Error:** ${err.message}`,
            isError: true
          };
        }
        return m;
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (showMentionMenu && filteredMentionFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx(prev => (prev + 1) % filteredMentionFiles.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx(prev => (prev - 1 + filteredMentionFiles.length) % filteredMentionFiles.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredMentionFiles[selectedMentionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-200 select-text overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#252526] border-b border-white/10 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-indigo-500/20 text-indigo-400">
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              OwlSync AI Agent
              <span className="text-[9px] bg-indigo-500/30 text-indigo-300 font-mono px-1.5 py-0.2 rounded border border-indigo-500/30">v2.1</span>
            </h3>
            <p className="text-[10px] text-gray-400">Autonomous pair programmer & tool executor</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setMessages([messages[0]]);
            setActiveSteps([]);
            setAttachedFiles([]);
          }}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Clear Conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Context Badge */}
      <div className="px-3 py-1.5 bg-[#2d2d2d] border-b border-white/5 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
        <div className="flex items-center space-x-1.5 truncate">
          <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">
            {activeFile ? (
              <>
                <span className="text-white font-medium">{activeFile.name}</span>
                {selectedCode && <span className="text-indigo-300 ml-1 font-mono text-[10px] bg-indigo-900/60 px-1 py-0.2 rounded">(Selection)</span>}
              </>
            ) : (
              'Workspace Context Active'
            )}
          </span>
        </div>
        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300 shrink-0">
          {projectFiles.length} files indexed
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-2 mb-1">
              {msg.role === 'user' ? (
                <>
                  <span className="text-[11px] text-gray-400">You</span>
                  <AvatarDisplay avatarUrl={user?.avatarUrl} name={user?.name || user?.username} size={18} />
                </>
              ) : (
                <>
                  <div className="w-[18px] h-[18px] rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white shadow-sm">
                    🦉
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-300">OwlSync Agent</span>
                </>
              )}
            </div>

            <div 
              className={`rounded-lg px-3.5 py-2.5 text-xs max-w-[95%] leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : msg.isError
                    ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                    : 'bg-[#252526] text-gray-200 border border-white/5 shadow-sm'
              }`}
            >
              {/* Context Tags & Mention Badges */}
              {(msg.contextTag || (msg.contextFiles && msg.contextFiles.length > 0)) && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {msg.contextTag && (
                    <div className="text-[10px] text-indigo-200 bg-indigo-700/60 px-2 py-0.5 rounded font-mono">
                      📎 {msg.contextTag}
                    </div>
                  )}
                  {msg.contextFiles?.map((cfName, cfIdx) => (
                    <div key={cfIdx} className="text-[10px] text-indigo-200 bg-indigo-800/80 px-2 py-0.5 rounded font-mono border border-indigo-400/20">
                      @{cfName}
                    </div>
                  ))}
                </div>
              )}

              {/* Agent Steps Accordion if steps occurred */}
              {msg.steps && msg.steps.length > 0 && (
                <div className="mb-3 rounded-md bg-[#1a1a1a] border border-white/10 overflow-hidden not-prose">
                  <div 
                    onClick={() => setShowStepsDetails(!showStepsDetails)}
                    className="flex items-center justify-between px-3 py-1.5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors text-[11px] font-medium text-gray-300"
                  >
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Executed {msg.steps.length} tool actions</span>
                    </div>
                    {showStepsDetails ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  </div>

                  {showStepsDetails && (
                    <div className="p-2 space-y-1.5 border-t border-white/5 text-[11px] font-mono">
                      {msg.steps.map((step, sIdx) => (
                        <div key={step.id || sIdx} className="flex items-center gap-2 text-gray-300">
                          {step.status === 'running' ? (
                            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin shrink-0" />
                          ) : (
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          )}
                          <span className="truncate">{step.label || `Step ${sIdx + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Diff Review Card if AI proposed code changes */}
              {msg.diff && (
                <div className="my-2.5 rounded-lg bg-gradient-to-br from-indigo-950/40 via-[#1e1e1e] to-[#1a1a1a] border border-indigo-500/30 p-2.5 not-prose shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <div className="p-1 rounded bg-indigo-500/20 text-indigo-400 shrink-0">
                        <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <span className="font-mono text-[11px] text-white font-medium truncate">
                        {msg.diff.filePath || 'File Modified'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-300 font-mono px-1.5 py-0.2 rounded border border-emerald-500/30 shrink-0">
                      Diff Ready
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => onDiffProposed?.(msg.diff)}
                      className="flex-1 flex items-center justify-center space-x-1 px-2 py-1 bg-white/10 hover:bg-white/15 text-gray-200 rounded text-[11px] font-medium transition-all"
                      title="Inspect Side-by-Side Diff in Editor"
                    >
                      <Eye className="w-3 h-3 text-indigo-400" />
                      <span>Review in Editor</span>
                    </button>

                    <button
                      onClick={() => onAcceptDiff?.(msg.diff)}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition-all shadow-sm active:scale-95"
                      title="Accept changes into workspace"
                    >
                      <Check className="w-3 h-3" />
                      <span>Accept</span>
                    </button>

                    <button
                      onClick={() => onRejectDiff?.(msg.diff)}
                      className="flex items-center space-x-1 px-2 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded text-[11px] font-medium transition-all border border-red-500/20 active:scale-95"
                      title="Reject changes"
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </button>

                    {/* Rollback Button if this file has snapshot in aiEditHistory */}
                    {(() => {
                      const matchingHistory = aiEditHistory.find(h => h.fileId === msg.diff.fileId || h.filePath === msg.diff.filePath);
                      const isRolledBack = rolledBackIds.has(msg.id) || (matchingHistory && rolledBackIds.has(matchingHistory.id));
                      if (matchingHistory || isRolledBack) {
                        return (
                          <button
                            onClick={() => matchingHistory && handleRollbackClick(matchingHistory, msg.id)}
                            disabled={isRolledBack}
                            className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
                              isRolledBack 
                                ? 'bg-gray-700/50 text-gray-400 border border-white/5 cursor-default' 
                                : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 shadow-sm active:scale-95'
                            }`}
                            title="Revert file back to pre-AI state"
                          >
                            <RotateCcw className="w-3 h-3 text-indigo-400" />
                            <span>{isRolledBack ? 'Rolled Back ✓' : 'Rollback'}</span>
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {/* Message Content with Markdown & Smart Apply */}
              <div className="prose prose-invert prose-xs max-w-none break-words">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeContent = String(children).replace(/\n$/, '');
                      const codeId = Math.random().toString();

                      if (!inline && match) {
                        return (
                          <div className="my-2 rounded bg-[#1e1e1e] border border-white/10 overflow-hidden not-prose">
                            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-[11px] text-gray-400">
                              <span className="font-mono text-indigo-300 font-semibold">{match[1]}</span>
                              <div className="flex items-center space-x-2">
                                {/* Smart Apply Button */}
                                {(onApplyCode || onInsertCode) && (
                                  <button
                                    onClick={() => handleApply(codeContent, codeId)}
                                    className={`px-2 py-0.5 rounded transition-all flex items-center text-[10px] font-medium ${
                                      appliedId === codeId 
                                        ? 'bg-emerald-600 text-white' 
                                        : 'bg-indigo-600/80 hover:bg-indigo-500 text-white shadow-sm'
                                    }`}
                                    title="Apply code changes directly to editor"
                                  >
                                    {appliedId === codeId ? (
                                      <>
                                        <Check className="w-3 h-3 mr-1 text-white" />
                                        <span>Applied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <ArrowRightCircle className="w-3 h-3 mr-1" />
                                        <span>Apply to Editor</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                <button
                                  onClick={() => handleCopy(codeContent, codeId)}
                                  className="p-1 hover:text-white transition-colors"
                                  title="Copy code"
                                >
                                  {copiedId === codeId ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <pre className="p-3 text-[11.5px] font-mono overflow-x-auto text-gray-200 leading-normal">
                              <code>{children}</code>
                            </pre>
                          </div>
                        );
                      }
                      return (
                        <code className="bg-white/10 px-1 py-0.5 rounded font-mono text-[11px] text-indigo-200" {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {msg.content}
                </ReactMarkdown>

                {/* Blinking cursor for active generation */}
                {loading && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id && (
                  !msg.content ? (
                    <div className="flex items-center space-x-2 text-indigo-400 py-1 font-mono text-[11px]">
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                      <span>OwlSync Agent thinking...</span>
                    </div>
                  ) : (
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-400 animate-pulse align-middle shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                  )
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Live Active Steps Box while running */}
        {loading && activeSteps.length > 0 && (
          <div className="rounded-lg p-3 bg-[#1e1e1e] border border-indigo-500/30 shadow-md space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                Autonomous Execution in Progress
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {activeSteps.filter(s => s.status === 'completed').length}/{activeSteps.length}
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              {activeSteps.map((st, idx) => (
                <div key={st.id || idx} className="flex items-center gap-2 text-[11px] font-mono">
                  {st.status === 'running' ? (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className={st.status === 'running' ? 'text-white font-medium animate-pulse' : 'text-gray-400'}>
                    {st.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips */}
      <div className="px-3 py-2 bg-[#252526] border-t border-white/10 shrink-0">
        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 tracking-wider flex items-center justify-between">
          <span>Autonomous Agent Actions</span>
          <span className="text-[9px] text-indigo-300 lowercase font-normal font-mono">type @ for files</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleSend('Explain this code snippet, its architecture, and runtime complexity.')}
            disabled={loading || !activeFile}
            className="flex items-center space-x-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded text-[11px] transition-all disabled:opacity-40 disabled:pointer-events-none border border-white/5"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Explain</span>
          </button>

          <button
            onClick={() => handleSend('Generate complete unit tests covering all functions and edge cases in a new test file.')}
            disabled={loading || !activeFile}
            className="flex items-center space-x-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded text-[11px] transition-all disabled:opacity-40 disabled:pointer-events-none border border-white/5"
          >
            <Wrench className="w-3 h-3 text-emerald-400" />
            <span>Generate Tests</span>
          </button>

          <button
            onClick={() => handleSend('Scan workspace for bugs and syntax errors, and fix them in the files.')}
            disabled={loading}
            className="flex items-center space-x-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded text-[11px] transition-all disabled:opacity-40 disabled:pointer-events-none border border-white/5"
          >
            <Bug className="w-3 h-3 text-rose-400" />
            <span>Find & Fix Bugs</span>
          </button>

          <button
            onClick={() => handleSend('Refactor this file for clean architecture, modularity, and error handling.')}
            disabled={loading || !activeFile}
            className="flex items-center space-x-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded text-[11px] transition-all disabled:opacity-40 disabled:pointer-events-none border border-white/5"
          >
            <Terminal className="w-3 h-3 text-cyan-400" />
            <span>Refactor</span>
          </button>

          <button
            onClick={() => handleSend('Summarize our collaborative session timeline into standup notes and git commit messages.')}
            disabled={loading}
            className="flex items-center space-x-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded text-[11px] transition-all disabled:opacity-40 disabled:pointer-events-none border border-white/5"
          >
            <GitCommit className="w-3 h-3 text-indigo-400" />
            <span>Commit Msg</span>
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#1e1e1e] border-t border-white/10 shrink-0 relative">
        {/* Floating @file Mention Autocomplete Dropdown */}
        {showMentionMenu && filteredMentionFiles.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#252526] border border-indigo-500/40 rounded-lg shadow-2xl overflow-hidden z-50 max-h-48 flex flex-col">
            <div className="px-3 py-1.5 bg-indigo-950/80 border-b border-white/10 text-[10.5px] font-semibold text-indigo-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <AtSign className="w-3 h-3 text-indigo-400" />
                Select File Context
              </span>
              <span className="text-[9px] text-gray-400 font-mono">↑↓ to navigate, ↵ to select</span>
            </div>
            <div className="overflow-y-auto scrollbar-thin divide-y divide-white/5">
              {filteredMentionFiles.map((file, idx) => (
                <div
                  key={file.id || file.path || idx}
                  onClick={() => handleSelectMention(file)}
                  className={`px-3 py-1.5 cursor-pointer flex items-center justify-between text-xs transition-colors ${
                    idx === selectedMentionIdx ? 'bg-indigo-600 text-white font-medium' : 'hover:bg-white/10 text-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileCode className={`w-3.5 h-3.5 ${idx === selectedMentionIdx ? 'text-white' : 'text-indigo-400'} shrink-0`} />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <span className={`text-[10px] font-mono truncate max-w-[120px] ${idx === selectedMentionIdx ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {file.path}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attached Context Files Chips Bar */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachedFiles.map((f) => (
              <div 
                key={f.id || f.path} 
                className="flex items-center space-x-1 px-2 py-0.5 bg-indigo-900/60 border border-indigo-500/40 text-indigo-200 rounded text-[10.5px] font-mono shadow-sm"
              >
                <Paperclip className="w-3 h-3 text-indigo-300 shrink-0" />
                <span className="truncate max-w-[130px]">{f.name}</span>
                <button 
                  onClick={() => handleRemoveAttachedFile(f)}
                  className="hover:text-white ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-center">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask agent or type @ to mention files..."
            rows={1}
            className="w-full bg-[#252526] text-white text-xs rounded-md pl-3 pr-10 py-2.5 border border-white/10 focus:border-indigo-500 focus:outline-none resize-none placeholder:text-gray-500 leading-normal"
            style={{ maxHeight: '100px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="absolute right-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-all disabled:opacity-30 disabled:pointer-events-none shadow-sm active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
