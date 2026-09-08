import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { 
  GitBranch, GitCommit, GitPullRequest, Sparkles, Check, 
  RotateCcw, Plus, Minus, Eye, Trash2, ArrowUp, ArrowDown,
  RefreshCw, History, FileCode, CheckCircle2, ChevronDown, ChevronRight,
  GitMerge, Tag, FolderGit2
} from 'lucide-react';
import { format } from 'date-fns';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';

export const SourceControlPanel = ({
  projectId,
  projectFiles = [],
  openFiles = [],
  currentUser,
  onFileSelect,
  onOpenDiff,
  onRevertFile,
  isProjectMode
}) => {
  const [activeTab, setActiveTab] = useState('changes'); // 'changes' | 'history'
  const [branch, setBranch] = useState('main');
  const [branches, setBranches] = useState(['main', 'dev', 'feature/collaboration']);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);

  const [commitMessage, setCommitMessage] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Staged and Unstaged tracking
  const [stagedPaths, setStagedPaths] = useState(new Set());
  const [committedSnapshots, setCommittedSnapshots] = useState(new Map()); // path -> content at last commit
  const [commitHistory, setCommitHistory] = useState([]);

  // Load project activities and initialize baseline committed snapshots
  useEffect(() => {
    let isDisposed = false;

    const initGitState = async () => {
      try {
        const activities = await api.getActivities(projectId);
        if (!isDisposed && activities) {
          // Filter git commit activities
          const gitCommits = activities.filter(a => a.type === 'GIT_COMMIT' || (a.metadata && a.metadata.isCommit));
          setCommitHistory(gitCommits);
        }
      } catch (err) {
        console.warn('Failed to load git activities:', err);
      }
    };

    initGitState();

    // Populate baseline snapshots from initial files if not present
    if (committedSnapshots.size === 0 && projectFiles.length > 0) {
      const initialMap = new Map();
      projectFiles.forEach(f => {
        initialMap.set(f.path, f.content || '');
      });
      setCommittedSnapshots(initialMap);
    }

    return () => {
      isDisposed = true;
    };
  }, [projectId]);

  // Detect file modifications against committed snapshots
  const workingChanges = useMemo(() => {
    const changes = [];
    const currentFilesMap = new Map();

    projectFiles.forEach(f => {
      if (!f.name || f.name.endsWith('.keep')) return;
      currentFilesMap.set(f.path, f);

      const baseline = committedSnapshots.get(f.path);
      if (baseline === undefined) {
        // New / Untracked file
        changes.push({
          file: f,
          path: f.path,
          name: f.name,
          status: 'ADDED',
          statusLetter: 'U',
          color: 'text-emerald-400',
          originalContent: '',
          newContent: f.content || ''
        });
      } else if (baseline !== f.content) {
        // Modified file
        changes.push({
          file: f,
          path: f.path,
          name: f.name,
          status: 'MODIFIED',
          statusLetter: 'M',
          color: 'text-amber-400',
          originalContent: baseline,
          newContent: f.content || ''
        });
      }
    });

    // Check for deleted files
    committedSnapshots.forEach((baselineContent, path) => {
      if (!currentFilesMap.has(path) && !path.endsWith('.keep')) {
        const name = path.split('/').pop();
        changes.push({
          file: { id: path, path, name },
          path,
          name,
          status: 'DELETED',
          statusLetter: 'D',
          color: 'text-rose-400',
          originalContent: baselineContent,
          newContent: ''
        });
      }
    });

    return changes;
  }, [projectFiles, committedSnapshots]);

  // Split into Staged vs Unstaged
  const stagedChanges = useMemo(() => {
    return workingChanges.filter(c => stagedPaths.has(c.path));
  }, [workingChanges, stagedPaths]);

  const unstagedChanges = useMemo(() => {
    return workingChanges.filter(c => !stagedPaths.has(c.path));
  }, [workingChanges, stagedPaths]);

  // Stage single file
  const handleStageFile = (filePath) => {
    setStagedPaths(prev => new Set([...prev, filePath]));
  };

  // Unstage single file
  const handleUnstageFile = (filePath) => {
    setStagedPaths(prev => {
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
  };

  // Stage All
  const handleStageAll = () => {
    const allPaths = workingChanges.map(c => c.path);
    setStagedPaths(new Set(allPaths));
  };

  // Unstage All
  const handleUnstageAll = () => {
    setStagedPaths(new Set());
  };

  // Discard file changes
  const handleDiscardFile = (change) => {
    if (window.confirm(`Discard all changes in ${change.name}?`)) {
      if (onRevertFile) {
        onRevertFile(change.file, change.originalContent);
      }
      handleUnstageFile(change.path);
    }
  };

  // AI Commit Message Generation
  const handleGenerateAICommit = async () => {
    const targetChanges = stagedChanges.length > 0 ? stagedChanges : workingChanges;
    if (targetChanges.length === 0) {
      alert('No file changes detected to generate a commit message.');
      return;
    }

    setGeneratingAI(true);
    try {
      const diffSummary = targetChanges.map(c => 
        `File: ${c.path} [${c.status}]\n`
      ).join('\n');

      const message = await api.generateCommitMessage({
        files: targetChanges.map(c => ({ path: c.path, name: c.name, status: c.status })),
        diffSummary
      });

      if (message) {
        setCommitMessage(message.trim());
      }
    } catch (err) {
      console.error('Failed to generate commit message:', err);
      setCommitMessage(`feat: update ${targetChanges.map(c => c.name).join(', ')}`);
    } finally {
      setGeneratingAI(false);
    }
  };

  // Commit Staged or All Changes
  const handleCommit = async (shouldPush = false) => {
    const targetChanges = stagedChanges.length > 0 ? stagedChanges : workingChanges;
    if (targetChanges.length === 0) {
      alert('No changes to commit.');
      return;
    }

    const msg = commitMessage.trim() || `update ${targetChanges.length} files`;
    setIsCommitting(true);

    try {
      const commitHash = Math.random().toString(36).substring(2, 9);
      const commitData = {
        type: 'GIT_COMMIT',
        description: `${currentUser?.name || 'Developer'} committed [${branch}]: ${msg}`,
        metadata: {
          isCommit: true,
          commitHash,
          branch,
          message: msg,
          filesCount: targetChanges.length,
          files: targetChanges.map(c => c.path),
          author: currentUser?.name || currentUser?.username || 'Developer',
          avatarUrl: currentUser?.avatarUrl,
          timestamp: new Date().toISOString()
        }
      };

      // Record in project activities
      const newActivity = await api.createActivity(projectId, commitData);
      setCommitHistory(prev => [newActivity || commitData, ...prev]);

      // Update committed baseline snapshots
      setCommittedSnapshots(prev => {
        const next = new Map(prev);
        targetChanges.forEach(c => {
          if (c.status === 'DELETED') {
            next.delete(c.path);
          } else {
            next.set(c.path, c.newContent);
          }
        });
        return next;
      });

      // Clear staged & message
      setStagedPaths(new Set());
      setCommitMessage('');

      const socket = socketService.getSocket();
      if (socket && newActivity) {
        socket.emit('project:activity:new', { projectId, activity: newActivity });
      }

    } catch (err) {
      console.error('Failed to commit changes:', err);
      alert('Failed to commit: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCommitting(false);
    }
  };

  // Create New Branch
  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return;
    const cleanBranch = newBranchName.trim().replace(/\s+/g, '-').toLowerCase();
    if (!branches.includes(cleanBranch)) {
      setBranches(prev => [...prev, cleanBranch]);
    }
    setBranch(cleanBranch);
    setNewBranchName('');
    setShowNewBranchInput(false);
    setShowBranchMenu(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#252526] w-80 shrink-0 border-r border-white/10 select-text overflow-hidden">
      {/* Top Header */}
      <div className="px-4 py-2.5 bg-[#1e1e1e] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-indigo-500/20 text-indigo-400">
            <GitBranch className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Source Control
            </h3>
            <p className="text-[10px] text-gray-400">Git repository & visual staging</p>
          </div>
        </div>

        {/* View Tabs: Changes vs History */}
        <div className="flex items-center bg-black/40 rounded p-0.5 border border-white/10 text-[11px] font-medium">
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'changes' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            Changes {workingChanges.length > 0 && `(${workingChanges.length})`}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'history' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Branch & Sync Bar */}
      <div className="px-3 py-2 bg-[#202021] border-b border-white/10 flex items-center justify-between shrink-0 relative">
        <div className="relative">
          <button
            onClick={() => setShowBranchMenu(!showBranchMenu)}
            className="flex items-center space-x-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-mono border border-white/10 transition-colors"
            title="Switch or Create Branch"
          >
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-white truncate max-w-[120px]">{branch}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {/* Branch Dropdown Menu */}
          {showBranchMenu && (
            <div 
              className="absolute left-0 top-full mt-1.5 w-56 bg-[#252526] border border-white/15 rounded-lg shadow-2xl py-1.5 z-50 text-xs flex flex-col animate-in fade-in duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-white/5">
                Switch Branch
              </div>
              <div className="max-h-40 overflow-y-auto py-1 divide-y divide-white/5">
                {branches.map(b => (
                  <div
                    key={b}
                    onClick={() => {
                      setBranch(b);
                      setShowBranchMenu(false);
                    }}
                    className={`px-3 py-1.5 cursor-pointer flex items-center justify-between transition-colors ${
                      branch === b ? 'bg-indigo-600 text-white font-semibold' : 'hover:bg-white/10 text-gray-200'
                    }`}
                  >
                    <span className="font-mono truncate">{b}</span>
                    {branch === b && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-white/10">
                {!showNewBranchInput ? (
                  <button
                    onClick={() => setShowNewBranchInput(true)}
                    className="w-full flex items-center justify-center space-x-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white rounded text-[11px] font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create New Branch...</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                      placeholder="branch-name"
                      autoFocus
                      className="w-full bg-[#1e1e1e] text-white text-[11px] px-2 py-1 rounded border border-indigo-500 focus:outline-none font-mono"
                    />
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={handleCreateBranch}
                        className="flex-1 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10.5px] font-medium"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => setShowNewBranchInput(false)}
                        className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded text-[10.5px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Push & Pull Actions */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => alert(`Pulled latest commits from origin/${branch}`)}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Fetch & Pull origin"
          >
            <ArrowDown className="w-3.5 h-3.5 text-indigo-300" />
          </button>
          <button
            onClick={() => alert(`Pushed commits to origin/${branch}`)}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Push to origin"
          >
            <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'changes' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Commit Message Box */}
          <div className="p-3 bg-[#1e1e1e] border-b border-white/10 shrink-0 space-y-2">
            <div className="relative">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleCommit();
                  }
                }}
                placeholder="Message (Ctrl+Enter to commit)"
                rows={2}
                className="w-full bg-[#252526] text-white text-xs rounded-md p-2.5 border border-white/10 focus:border-indigo-500 focus:outline-none resize-none placeholder:text-gray-500 font-mono leading-normal"
              />
            </div>

            {/* Commit Actions & AI Generator Button */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleGenerateAICommit}
                disabled={generatingAI || workingChanges.length === 0}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 rounded text-[11px] font-medium transition-all disabled:opacity-40 shadow-sm"
                title="Generate conventional commit message with Gemini AI"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${generatingAI ? 'animate-spin' : ''}`} />
                <span>{generatingAI ? 'Generating...' : '✨ Generate with AI'}</span>
              </button>

              <button
                onClick={() => handleCommit(false)}
                disabled={isCommitting || workingChanges.length === 0}
                className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11.5px] font-semibold transition-all shadow-md active:scale-95 disabled:opacity-40 border border-indigo-400/30"
                title="Commit Staged Changes (Ctrl+Enter)"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isCommitting ? 'Committing...' : 'Commit'}</span>
              </button>
            </div>
          </div>

          {/* Staged & Unstaged Trees */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
            {/* 1. Staged Changes Section */}
            {stagedChanges.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Staged Changes ({stagedChanges.length})
                  </span>
                  <button
                    onClick={handleUnstageAll}
                    className="text-[10px] text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors font-mono lowercase"
                    title="Unstage All Changes"
                  >
                    unstage all
                  </button>
                </div>

                <div className="space-y-1">
                  {stagedChanges.map(change => (
                    <div
                      key={change.path}
                      onClick={() => onOpenDiff?.(change)}
                      className="group flex items-center justify-between p-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition-all text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-white font-medium truncate">{change.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono truncate">{change.path}</span>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className={`font-mono text-[11px] font-bold ${change.color}`}>
                          {change.statusLetter}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnstageFile(change.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-white rounded transition-opacity"
                          title="Unstage Change"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Unstaged Changes Section */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                <span>Changes ({unstagedChanges.length})</span>
                {unstagedChanges.length > 0 && (
                  <button
                    onClick={handleStageAll}
                    className="text-[10px] text-indigo-300 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors font-mono lowercase"
                    title="Stage All Changes"
                  >
                    + stage all
                  </button>
                )}
              </div>

              {unstagedChanges.length === 0 && stagedChanges.length === 0 ? (
                <div className="text-center text-gray-500 text-xs py-8">
                  No changes in working tree.
                </div>
              ) : (
                <div className="space-y-1">
                  {unstagedChanges.map(change => (
                    <div
                      key={change.path}
                      onClick={() => onOpenDiff?.(change)}
                      className="group flex items-center justify-between p-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5 transition-all text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-gray-200 font-medium truncate">{change.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono truncate">{change.path}</span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <span className={`font-mono text-[11px] font-bold mr-1 ${change.color}`}>
                          {change.statusLetter}
                        </span>

                        {/* Stage Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStageFile(change.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-emerald-400 rounded transition-opacity"
                          title="Stage Change"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        {/* Discard Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDiscardFile(change);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-rose-400 rounded transition-opacity"
                          title="Discard Changes"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* History & Git Log Graph */
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
            Commit Graph & History ({commitHistory.length})
          </div>

          {commitHistory.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-8">
              No commit history yet. Make your first commit above!
            </div>
          ) : (
            <div className="space-y-3">
              {commitHistory.map((commit, cIdx) => {
                const meta = commit.metadata || {};
                const authorName = meta.author || 'Developer';
                const commitMsg = meta.message || commit.description;
                const commitSha = meta.commitHash || Math.random().toString(36).substring(2, 8);
                const isLast = cIdx === commitHistory.length - 1;

                return (
                  <div key={commit.id || cIdx} className="relative flex gap-3 group">
                    {/* Graph line */}
                    {!isLast && (
                      <div className="absolute left-[9px] top-6 bottom-[-16px] w-[2px] bg-indigo-500/40" />
                    )}

                    <div className="relative z-10 flex shrink-0 items-center justify-center w-5 h-5 rounded-full bg-indigo-600 border border-indigo-400 text-white mt-0.5 shadow-sm">
                      <GitCommit className="w-3 h-3" />
                    </div>

                    <div className="flex flex-col flex-1 pb-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded">
                          {commitSha}
                        </span>
                        <span className="text-[10.5px] text-gray-500 font-mono">
                          {commit.createdAt ? format(new Date(commit.createdAt), 'MMM d, h:mm a') : 'just now'}
                        </span>
                      </div>

                      <div className="text-[12px] text-gray-200 font-medium leading-normal break-words">
                        {commitMsg}
                      </div>

                      <div className="flex items-center space-x-2 mt-1.5 text-[11px] text-gray-400 font-mono">
                        <div className="flex items-center space-x-1">
                          <AvatarDisplay avatarUrl={meta.avatarUrl} name={authorName} size={14} />
                          <span className="text-gray-300">{authorName}</span>
                        </div>
                        {meta.filesCount && (
                          <span>• {meta.filesCount} files</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
