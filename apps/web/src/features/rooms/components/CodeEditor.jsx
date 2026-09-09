import React, { useRef, useEffect, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { Sparkles, Check, X, Split, Columns2, Code2, ArrowRight, RotateCcw } from 'lucide-react';
import { socketService } from '../../../services/socket';
import { api } from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';
import * as awarenessProtocol from 'y-protocols/awareness';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';

const getLanguageFromFileName = (fileName) => {
  if (!fileName) return 'plaintext';
  if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript';
  if (fileName.endsWith('.py')) return 'python';
  if (fileName.endsWith('.html')) return 'html';
  if (fileName.endsWith('.css')) return 'css';
  if (fileName.endsWith('.json')) return 'json';
  if (fileName.endsWith('.rs')) return 'rust';
  if (fileName.endsWith('.go')) return 'go';
  if (fileName.endsWith('.cpp')) return 'cpp';
  if (fileName.endsWith('.java')) return 'java';
  return 'plaintext';
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'just now';
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(time)) return 'just now';
  const diffInSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));

  if (diffInSeconds < 10) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) return '1 min ago';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) return '1 hr ago';
  if (diffInHours < 24) return `${diffInHours} hrs ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'yesterday';
  if (diffInDays < 30) return `${diffInDays} days ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths === 1) return '1 month ago';
  if (diffInMonths < 12) return `${diffInMonths} months ago`;
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} yr${diffInYears > 1 ? 's' : ''} ago`;
};

const getAvatarSrc = (name, avatarUrl, userColor) => {
  if (avatarUrl && typeof avatarUrl === 'string') {
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://') || avatarUrl.startsWith('data:image/') || avatarUrl.startsWith('blob:')) {
      return avatarUrl;
    }
  }
  const cleanColor = (userColor || '#6366f1').replace('#', '');
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=${cleanColor}&color=fff&size=64&bold=true`;
};

const lastLogTimeMap = {};

export const CodeEditor = ({ 
  roomId, 
  projectId, 
  activeFile, 
  onSelectionChange, 
  onOpenAI,
  pendingDiff,
  onAcceptDiff,
  onRejectDiff,
  aiEditHistory = [],
  onRollback
}) => {
  const { user } = useAuth();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const yDocRef = useRef(null);
  const awarenessRef = useRef(null);
  const bindingRef = useRef(null);
  const socketRef = useRef(null);
  const latestFileRef = useRef(activeFile);
  const hoverDisposableRef = useRef(null);
  const remoteDecorationsRef = useRef([]);
  const diffEditorRef = useRef(null);
  const [cursorStyles, setCursorStyles] = useState('');
  const [diffViewMode, setDiffViewMode] = useState('split'); // 'split' | 'inline' | 'editor'

  const recentAiEdit = aiEditHistory?.find(h => h.fileId === activeFile?.id);

  const isDiffActive = !!(
    pendingDiff && 
    (pendingDiff.fileId === activeFile?.id || 
     pendingDiff.filePath === activeFile?.path || 
     (activeFile && pendingDiff.filePath?.endsWith(activeFile.name)))
  );

  const userName = user?.name || user?.username || 'Anonymous';
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#0ea5e9'];
  const hashCode = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return hash;
  };
  const userColor = user?.id ? colors[Math.abs(hashCode(user.id)) % colors.length] : colors[0];

  const lastActiveMapRef = useRef({});

  useEffect(() => {
    latestFileRef.current = activeFile;
    if (activeFile?.id && yDocRef.current) {
      const type = yDocRef.current.getText(activeFile.id);
      if (activeFile.content !== undefined && type.toString() !== activeFile.content) {
        yDocRef.current.transact(() => {
          type.delete(0, type.length);
          type.insert(0, activeFile.content);
        });
      }
    }
  }, [activeFile?.id, activeFile?.content, activeFile?.updatedAt]);

  const renderRemoteCursors = () => {
    if (!editorRef.current || !awarenessRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const states = awarenessRef.current.getStates();
    const doc = yDocRef.current;
    const currentFileId = latestFileRef.current?.id;
    const now = Date.now();

    const newDecorations = [];
    let css = '';

    states.forEach((state, clientId) => {
      // Local tab never renders remote decoration for itself
      if (!doc || clientId === doc.clientID) return;

      const cursor = state.cursor;
      if (!cursor || cursor.fileId !== currentFileId) return;

      const lastActive = lastActiveMapRef.current[clientId] || cursor.time || 0;
      // Inactive for > 2.5s -> Completely purge decoration from Monaco
      if (now - lastActive > 2500) return;

      const color = state.user?.color || '#3b82f6';
      const name = state.user?.name || 'Anonymous';
      const avatarUrl = state.user?.avatarUrl;
      const avatarSrc = getAvatarSrc(name, avatarUrl, color);

      const className = `owl-cursor-${clientId}`;
      const line = Math.max(1, cursor.lineNumber || 1);
      const col = Math.max(1, cursor.column || 1);

      css += `
        .${className} {
          position: absolute !important;
          border-left: 2px solid ${color} !important;
          margin-left: -1px !important;
          box-sizing: border-box !important;
          z-index: 50 !important;
          height: 100% !important;
        }
        .${className}::before {
          position: absolute !important;
          content: '' !important;
          width: 18px !important;
          height: 18px !important;
          border-radius: 50% !important;
          background-color: ${color} !important;
          background-image: url('${avatarSrc}') !important;
          background-size: cover !important;
          background-position: center !important;
          border: 1.5px solid #1e1e1e !important;
          left: -6px !important;
          top: -21px !important;
          z-index: 102 !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4) !important;
          display: block !important;
        }
        .${className}::after {
          position: absolute !important;
          content: '${name}' !important;
          background: ${color} !important;
          color: white !important;
          font-size: 11px !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-weight: 600 !important;
          padding: 1px 6px 1px 15px !important;
          border-radius: 4px !important;
          left: -2px !important;
          top: -20px !important;
          white-space: nowrap !important;
          z-index: 101 !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35) !important;
          letter-spacing: 0.2px !important;
          display: block !important;
        }
      `;

      newDecorations.push({
        range: new monaco.Range(line, col, line, col),
        options: {
          className: className,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });
    });

    setCursorStyles(css);
    remoteDecorationsRef.current = editor.deltaDecorations(remoteDecorationsRef.current, newDecorations);
  };

  // Initialize socket and Yjs doc (Shared across all files in the room)
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const doc = new Y.Doc();
    yDocRef.current = doc;

    const tabColor = colors[Math.abs(hashCode(doc.clientID.toString() + (user?.id || ''))) % colors.length];

    const awareness = new awarenessProtocol.Awareness(doc);
    awarenessRef.current = awareness;
    
    awareness.setLocalStateField('user', {
      name: userName,
      color: tabColor,
      avatarUrl: user?.avatarUrl || null,
      id: user?.id || null,
      typing: false,
      lastTyped: Date.now()
    });

    if (!roomId) return; // Solo Project Mode - No Socket sync

    socket.emit('editor:join', { roomId });

    const handleSync = ({ update }) => {
      Y.applyUpdate(doc, new Uint8Array(update), 'remote');
      const localAwareness = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]);
      socket.emit('editor:awareness', { roomId, update: Array.from(localAwareness) });
      socket.emit('editor:request_awareness', { roomId });
    };

    const handleUpdate = ({ update }) => {
      Y.applyUpdate(doc, new Uint8Array(update), 'remote');
    };

    const handleAwarenessUpdate = ({ update }) => {
      awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(update), socket);
    };

    const handleRequestAwareness = () => {
      const localAwareness = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]);
      socket.emit('editor:awareness', { roomId, update: Array.from(localAwareness) });
    };

    socket.on('editor:sync', handleSync);
    socket.on('editor:update', handleUpdate);
    socket.on('editor:awareness', handleAwarenessUpdate);
    socket.on('editor:request_awareness', handleRequestAwareness);

    doc.on('update', (update, origin) => {
      if (origin !== 'remote' && roomId) {
        socket.emit('editor:update', { roomId, update: Array.from(update) });
      }
    });

    awareness.on('update', ({ added, updated, removed }, origin) => {
      const now = Date.now();
      added.forEach(id => { 
        if (id !== doc.clientID) lastActiveMapRef.current[id] = now; 
      });
      updated.forEach(id => { 
        if (id !== doc.clientID) lastActiveMapRef.current[id] = now; 
      });
      removed.forEach(id => { delete lastActiveMapRef.current[id]; });

      if (origin !== socket && roomId) {
        const changedClients = added.concat(updated).concat(removed);
        const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
        socket.emit('editor:awareness', { roomId, update: Array.from(update) });
      }
    });

    awareness.on('change', () => {
      renderRemoteCursors();
    });
    
    const idleInterval = setInterval(() => {
      renderRemoteCursors();
    }, 200);

    return () => {
      clearInterval(idleInterval);
      if (roomId) {
        socket.off('editor:sync', handleSync);
        socket.off('editor:update', handleUpdate);
        socket.off('editor:awareness', handleAwarenessUpdate);
        socket.off('editor:request_awareness', handleRequestAwareness);
      }
      try {
        awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], socket);
        const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]);
        if (socket && roomId) {
          socket.emit('editor:awareness', { roomId, update: Array.from(update) });
        }
      } catch (e) {}
      if (bindingRef.current) bindingRef.current.destroy();
      if (hoverDisposableRef.current) hoverDisposableRef.current.dispose();
      awareness.destroy();
      doc.destroy();
    };
  }, [roomId, user, userName, userColor]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    const bindEditor = (fileId, fileContent) => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      
      if (!yDocRef.current || !editor) return;

      const type = yDocRef.current.getText(fileId);
      if (!roomId && type.toString() === '' && fileContent) {
        type.insert(0, fileContent);
      }
      
      // Pass null awareness to MonacoBinding so we have complete, pristine control of decorations
      bindingRef.current = new MonacoBinding(
        type, 
        editor.getModel(), 
        new Set([editor]),
        null
      );
    };

    // Initial binding
    if (activeFile) {
      bindEditor(activeFile.id, activeFile.content);
    }

    // Broadcast local cursor position over Yjs awareness on cursor move
    editor.onDidChangeCursorPosition((e) => {
      if (awarenessRef.current && latestFileRef.current) {
        awarenessRef.current.setLocalStateField('cursor', {
          lineNumber: e.position.lineNumber,
          column: e.position.column,
          fileId: latestFileRef.current.id,
          time: Date.now()
        });
      }
    });

    // Register GitLens-style Code Authorship Hover Provider
    if (hoverDisposableRef.current) {
      hoverDisposableRef.current.dispose();
    }

    hoverDisposableRef.current = monaco.languages.registerHoverProvider('*', {
      provideHover: (model, position) => {
        const lineNumber = position.lineNumber;
        const lineContent = model.getLineContent(lineNumber);
        if (!lineContent || !lineContent.trim()) return null;

        const currentFile = latestFileRef.current;
        if (!currentFile || !yDocRef.current) return null;

        const authorshipMap = yDocRef.current.getMap('authorship');
        const key = `${currentFile.id}:${lineNumber}`;
        const record = authorshipMap.get(key);

        let author = userName;
        let avatarUrl = user?.avatarUrl;
        let color = userColor;
        let timestamp = currentFile?.updatedAt ? new Date(currentFile.updatedAt).getTime() : (currentFile?.createdAt ? new Date(currentFile.createdAt).getTime() : null);

        if (record) {
          author = record.author || author;
          avatarUrl = record.avatarUrl || (author === userName ? user?.avatarUrl : null);
          color = record.color || color;
          timestamp = record.timestamp || timestamp;
        }

        const timeAgo = formatTimeAgo(timestamp);
        const avatarSrc = getAvatarSrc(author, avatarUrl, color);

        return {
          range: new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)),
          contents: [
            {
              supportHtml: true,
              isTrusted: true,
              value: `<img src="${avatarSrc}" width="18" height="18" style="border-radius: 50%; object-fit: cover; vertical-align: -3px; margin-right: 6px; border: 1px solid ${color};" /> **${author}** &bull; *${timeAgo}*\n\n---\n*OwlSync Live Authorship*`
            }
          ]
        };
      }
    });

    // Listen for edits to record per-line authorship in Yjs
    editor.onDidChangeModelContent((e) => {
      if (!yDocRef.current || !latestFileRef.current) return;
      const authorshipMap = yDocRef.current.getMap('authorship');
      const fileId = latestFileRef.current.id;
      const now = Date.now();

      e.changes.forEach(change => {
        const startLine = change.range.startLineNumber;
        const endLine = change.range.endLineNumber;
        for (let l = startLine; l <= Math.max(startLine, endLine); l++) {
          authorshipMap.set(`${fileId}:${l}`, {
            author: userName,
            color: userColor,
            avatarUrl: user?.avatarUrl || null,
            timestamp: now
          });
        }
      });
    });

    // Listen for selection changes to feed into AI Pair Programmer
    editor.onDidChangeCursorSelection((e) => {
      if (onSelectionChange && editor.getModel()) {
        const text = editor.getModel().getValueInRange(e.selection);
        onSelectionChange(text);
      }
    });

    // Add Context Menu Action for OwlSync AI
    editor.addAction({
      id: 'ask-owlsync-ai',
      label: '🦉 Ask OwlSync AI about Selection',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyA],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const selection = ed.getModel().getValueInRange(ed.getSelection());
        if (onOpenAI) {
          onOpenAI(selection);
        }
      }
    });

    // Listen for model changes (when path prop changes)
    editor.onDidChangeModel(() => {
      if (latestFileRef.current) {
        bindEditor(latestFileRef.current.id, latestFileRef.current.content);
      }
    });

  };

  const handleEditorChange = (value, ev) => {
    // Only log if it's an actual user edit (not remote Yjs sync)
    if (ev.isFlush) return;
    
    if (!projectId || !activeFile) return;

    const now = Date.now();
    const lastLog = lastLogTimeMap[activeFile.id] || 0;
    
    // Log at most once every 3 minutes (180000 ms) per file
    if (now - lastLog > 180000) {
      lastLogTimeMap[activeFile.id] = now;
      
      const userName = user?.name || user?.username || 'Anonymous';
      const description = `${userName} is editing ${activeFile.name}`;
      
      api.createActivity(projectId, {
        type: 'FILE_EDITED',
        description,
        metadata: { fileId: activeFile.id, fileName: activeFile.name }
      }).then(activity => {
        const socket = socketService.getSocket();
        if (socket && activity) {
          socket.emit('project:activity:new', { projectId, activity });
        }
      }).catch(console.error);
    }
  };

  // Safe helper to detach diff editor models before accepting/rejecting
  const handleSafeAccept = (diff) => {
    if (diffEditorRef.current) {
      try {
        diffEditorRef.current.setModel({ original: null, modified: null });
      } catch (e) {
        console.warn('DiffEditor detach on accept:', e);
      }
    }
    onAcceptDiff?.(diff || pendingDiff);
  };

  const handleSafeReject = (diff) => {
    if (diffEditorRef.current) {
      try {
        diffEditorRef.current.setModel({ original: null, modified: null });
      } catch (e) {
        console.warn('DiffEditor detach on reject:', e);
      }
    }
    onRejectDiff?.(diff || pendingDiff);
  };

  // Cleanup DiffEditor on unmount or diff close
  useEffect(() => {
    return () => {
      if (diffEditorRef.current) {
        try {
          const model = diffEditorRef.current.getModel();
          diffEditorRef.current.setModel({ original: null, modified: null });
          if (model?.original && !model.original.isDisposed()) {
            model.original.dispose();
          }
          if (model?.modified && !model.modified.isDisposed()) {
            model.modified.dispose();
          }
        } catch (e) {
          console.warn('Safe DiffEditor cleanup:', e);
        }
        diffEditorRef.current = null;
      }
    };
  }, [isDiffActive]);

  // Keyboard shortcuts for accepting/rejecting diffs
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isDiffActive) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSafeAccept(pendingDiff);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSafeReject(pendingDiff);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDiffActive, pendingDiff, onAcceptDiff, onRejectDiff]);

  if (!activeFile) return null;

  return (
    <div className="h-full w-full relative flex flex-col bg-[#1e1e1e] overflow-hidden select-text">
      <style dangerouslySetInnerHTML={{ __html: cursorStyles + `
        .monaco-editor .cursor {
          background-color: #ffffff !important;
          border-color: #ffffff !important;
          color: #ffffff !important;
          width: 2px !important;
          visibility: visible !important;
        }
      `}} />

      {/* Interactive AI Diff Review Bar (Cursor / Copilot Style) */}
      {isDiffActive && (
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-indigo-950/90 via-[#252526] to-[#1e1e1e] border-b border-indigo-500/40 text-xs text-gray-200 shrink-0 z-20 shadow-md">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white tracking-wide">AI Proposed Changes</span>
                <span className="text-[10px] bg-indigo-900/60 text-indigo-200 px-1.5 py-0.2 rounded font-mono border border-indigo-500/30 truncate">
                  {pendingDiff.filePath || activeFile.name}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 truncate">
                Review modifications before applying to workspace
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* View Mode Segmented Control */}
            <div className="flex items-center bg-black/40 rounded p-0.5 border border-white/10 text-[11px] font-medium">
              <button
                onClick={() => setDiffViewMode('split')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded transition-all ${diffViewMode === 'split' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'text-gray-400 hover:text-white'}`}
                title="Side-by-side Split Diff"
              >
                <Columns2 className="w-3 h-3" />
                <span>Split</span>
              </button>
              <button
                onClick={() => setDiffViewMode('inline')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded transition-all ${diffViewMode === 'inline' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'text-gray-400 hover:text-white'}`}
                title="Inline Unified Diff"
              >
                <Split className="w-3 h-3" />
                <span>Inline</span>
              </button>
              <button
                onClick={() => setDiffViewMode('editor')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded transition-all ${diffViewMode === 'editor' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'text-gray-400 hover:text-white'}`}
                title="Standard Editor Mode"
              >
                <Code2 className="w-3 h-3" />
                <span>Code</span>
              </button>
            </div>

            {/* Reject Button */}
            <button
              onClick={() => handleSafeReject(pendingDiff)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded text-xs transition-all shadow-sm font-medium active:scale-95"
              title="Discard AI proposed changes (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
              <span className="text-[9px] opacity-60 font-mono ml-0.5">Esc</span>
            </button>

            {/* Accept Button */}
            <button
              onClick={() => handleSafeAccept(pendingDiff)}
              className="flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-all shadow-md font-semibold active:scale-95 border border-emerald-400/30"
              title="Accept and apply AI changes (Ctrl+Enter)"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept Changes</span>
              <span className="text-[9px] opacity-80 font-mono ml-1 bg-emerald-700/80 px-1 py-0.2 rounded border border-white/20">Ctrl+↵</span>
            </button>
          </div>
        </div>
      )}

      {/* Revert AI Modifications Bar if previous AI snapshot exists */}
      {!isDiffActive && recentAiEdit && (
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-gradient-to-r from-indigo-950/70 via-[#252526] to-[#1e1e1e] border-b border-indigo-500/25 text-[11px] text-gray-300 shrink-0 z-10 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-gray-200 font-medium">AI modifications applied</span>
            <span className="text-[10px] text-indigo-300 font-mono">({formatTimeAgo(recentAiEdit.timestamp)})</span>
          </div>
          <button
            onClick={() => onRollback?.(recentAiEdit)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 hover:text-white rounded text-[11px] transition-all border border-indigo-500/30 font-medium shadow-sm active:scale-95"
            title="Revert file back to exact pre-AI state"
          >
            <RotateCcw className="w-3 h-3 text-indigo-300" />
            <span>Rollback AI Changes</span>
          </button>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 min-h-0 relative w-full h-full">
        <ErrorBoundary>
          {isDiffActive && diffViewMode !== 'editor' ? (
            <DiffEditor
              key={`diff-${pendingDiff.fileId || pendingDiff.filePath || 'active'}`}
              original={pendingDiff.originalContent || ''}
              modified={pendingDiff.newContent || ''}
              language={getLanguageFromFileName(activeFile.name)}
              theme="vs-dark"
              keepCurrentOriginalModel={true}
              keepCurrentModifiedModel={true}
              onMount={(diffEditor) => {
                diffEditorRef.current = diffEditor;
              }}
              options={{
                renderSideBySide: diffViewMode === 'split',
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 15,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                originalEditable: false
              }}
              loading={
                <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
                  <div className="text-gray-400 text-[14px]">Loading AI Visual Diff...</div>
                </div>
              }
            />
          ) : (
            <Editor
              path={activeFile.id}
              height="100%"
              language={getLanguageFromFileName(activeFile.name)}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 16,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                wordWrap: 'on',
                lineNumbersMinChars: 3,
                padding: { top: 20, bottom: 20 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'blink',
                cursorSmoothCaretAnimation: 'off',
                cursorWidth: 2,
                formatOnPaste: true,
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
              }}
              onMount={handleEditorDidMount}
              onChange={handleEditorChange}
              loading={
                <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
                  <div className="text-gray-400 text-[15px]">Loading Editor...</div>
                </div>
              }
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
};
