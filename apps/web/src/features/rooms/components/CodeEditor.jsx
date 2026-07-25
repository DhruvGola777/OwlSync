import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { socketService } from '../../../services/socket';
import { Languages } from 'lucide-react';
import { useAuth } from '../../../providers/AuthProvider';
import * as awarenessProtocol from 'y-protocols/awareness';
import { formatDistanceToNow } from 'date-fns';

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'html', 'css', 'rust', 'go', 'json', 'cpp', 'java'];

export const CodeEditor = ({ roomId, initialLanguage = 'javascript' }) => {
  const [language, setLanguage] = useState(initialLanguage);
  const { user } = useAuth();
  const editorRef = useRef(null);
  const yDocRef = useRef(null);
  const awarenessRef = useRef(null);
  const lineAttributionsRef = useRef(null);
  const bindingRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const doc = new Y.Doc();
    yDocRef.current = doc;

    // Create an awareness instance
    const awareness = new awarenessProtocol.Awareness(doc);
    awarenessRef.current = awareness;

    // Initialize line attributions map
    const attributions = doc.getMap('lineAttributions');
    lineAttributionsRef.current = attributions;

    // Set local awareness state
    const userName = user?.name || user?.username || 'Anonymous';
    // Generate a random color or based on user id for the cursor
    const userColor = user?.id ? `#${user.id.substring(0, 6)}` : '#6366f1';
    
    awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
      avatarUrl: user?.avatarUrl,
      id: user?.id,
      // Track typing state for fading
      typing: false,
      lastTyped: Date.now()
    });

    socket.emit('editor:join', { roomId });

    const handleSync = ({ update }) => {
      Y.applyUpdate(doc, new Uint8Array(update), 'remote');
      // Broadcast our awareness state so existing clients know we are here
      const localAwareness = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]);
      socket.emit('editor:awareness', { roomId, update: Array.from(localAwareness) });
      
      // Also request awareness from everyone else in the room
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

    const handleLangChange = ({ language: newLang }) => {
      setLanguage(newLang);
    };

    socket.on('editor:sync', handleSync);
    socket.on('editor:update', handleUpdate);
    socket.on('editor:awareness', handleAwarenessUpdate);
    socket.on('editor:request_awareness', handleRequestAwareness);
    socket.on('editor:language_change', handleLangChange);

    doc.on('update', (update, origin) => {
      if (origin !== 'remote') {
        socket.emit('editor:update', { roomId, update: Array.from(update) });
      }
    });

    awareness.on('update', ({ added, updated, removed }, origin) => {
      if (origin !== socket) {
        const changedClients = added.concat(updated).concat(removed);
        const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
        socket.emit('editor:awareness', { roomId, update: Array.from(update) });
      }
    });

    return () => {
      socket.off('editor:sync', handleSync);
      socket.off('editor:update', handleUpdate);
      socket.off('editor:awareness', handleAwarenessUpdate);
      socket.off('editor:request_awareness', handleRequestAwareness);
      socket.off('editor:language_change', handleLangChange);
      if (bindingRef.current) bindingRef.current.destroy();
      awareness.destroy();
      doc.destroy();
    };
  }, [roomId, user]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    if (yDocRef.current) {
      const type = yDocRef.current.getText('monaco');
      // Create a binding between Yjs type and Monaco model
      bindingRef.current = new MonacoBinding(
        type, 
        editor.getModel(), 
        new Set([editor]),
        awarenessRef.current
      );

      // Track local changes for attribution
      editor.onDidChangeModelContent((e) => {
        if (!e.isFlush && editor.hasTextFocus()) {
          const now = Date.now();
          const userId = user?.id || 'anonymous';
          const userName = user?.name || user?.username || 'Anonymous';
          
          setTimeout(() => {
            if (!yDocRef.current) return;
            yDocRef.current.transact(() => {
              e.changes.forEach(change => {
                // For MVP: simply mark the lines that were changed with the current user.
                for (let i = change.range.startLineNumber; i <= change.range.endLineNumber; i++) {
                  if (lineAttributionsRef.current) {
                    lineAttributionsRef.current.set(i.toString(), {
                      userId,
                      name: userName,
                      timestamp: now
                    });
                  }
                }
              });
            }, 'local-attribution');
          }, 0);
        }
      });

      // Register hover provider for attribution
      monaco.languages.registerHoverProvider('*', {
        provideHover: (model, position) => {
          if (!lineAttributionsRef.current) return null;
          
          const attribution = lineAttributionsRef.current.get(position.lineNumber.toString());
          if (attribution) {
            const timeAgo = formatDistanceToNow(new Date(attribution.timestamp), { addSuffix: true });
            const isMe = attribution.userId === (user?.id || 'anonymous');
            const authorText = isMe ? 'You' : attribution.name;
            
            return {
              range: new monaco.Range(position.lineNumber, 1, position.lineNumber, model.getLineMaxColumn(position.lineNumber)),
              contents: [
                { value: `**${authorText}** edited this ${timeAgo}` }
              ]
            };
          }
          return null;
        }
      });

      // Implement Custom Native Monaco Remote Cursors
      const widgets = new Map();

      // Hide the native y-monaco cursors so they don't conflict with our beautiful custom ones
      const styleId = 'hide-ymonaco-cursors';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `.yRemoteSelectionHead { display: none !important; }`;
        document.head.appendChild(style);
      }

      const updateCursors = () => {
        if (!editor.getModel() || !yDocRef.current || !awarenessRef.current) return;
        
        const states = awarenessRef.current.getStates();
        const localId = yDocRef.current.clientID;

        states.forEach((state, clientId) => {
          if (clientId === localId) return; // Don't render our own cursor

          if (state.cursor && state.user) {
            let absPos;
            try {
               absPos = Y.createAbsolutePositionFromRelativePosition(state.cursor.head, yDocRef.current);
            } catch (e) {
               return;
            }
            if (!absPos) return;

            const pos = editor.getModel().getPositionAt(absPos.index);
            
            let widget = widgets.get(clientId);
            if (!widget) {
              const domNode = document.createElement('div');
              // Let Monaco handle the root positioning
              domNode.style.width = '2px';
              domNode.style.height = '18px';
              domNode.style.backgroundColor = state.user.color || '#6366f1';
              domNode.style.zIndex = '50';
              domNode.style.pointerEvents = 'none';
              
              const tooltip = document.createElement('div');
              tooltip.style.position = 'absolute';
              tooltip.style.bottom = '100%';
              tooltip.style.left = '0';
              tooltip.style.marginBottom = '2px';
              tooltip.style.display = 'flex';
              tooltip.style.alignItems = 'center';
              tooltip.style.padding = '3px 8px';
              tooltip.style.borderRadius = '6px';
              tooltip.style.whiteSpace = 'nowrap';
              tooltip.style.backgroundColor = state.user.color || '#6366f1';
              tooltip.style.color = '#fff';
              tooltip.style.fontSize = '12px';
              tooltip.style.fontWeight = '600';
              tooltip.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
              
              const img = document.createElement('img');
              img.src = state.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.name)}&background=random&color=fff&size=20`;
              img.style.width = '16px';
              img.style.height = '16px';
              img.style.borderRadius = '50%';
              img.style.marginRight = '4px';
              
              const span = document.createElement('span');
              span.textContent = state.user.name;
              
              tooltip.appendChild(img);
              tooltip.appendChild(span);
              domNode.appendChild(tooltip);

              widget = {
                id: `cursor-${clientId}`,
                domNode,
                position: pos,
                fadeTimeout: null,
                getId: function() { return this.id; },
                getDomNode: function() { return this.domNode; },
                getPosition: function() {
                  return {
                    position: this.position,
                    preference: [0] // EXACT
                  };
                }
              };
              
              editor.addContentWidget(widget);
              widgets.set(clientId, widget);
            } else {
              widget.position = pos;
              editor.layoutContentWidget(widget);
            }

            // Reset fade out
            if (widget.fadeTimeout) clearTimeout(widget.fadeTimeout);
            widget.domNode.style.opacity = '1';
            widget.domNode.style.transition = 'none';
            
            widget.fadeTimeout = setTimeout(() => {
              if (widget.domNode) {
                widget.domNode.style.transition = 'opacity 0.5s ease-out';
                widget.domNode.style.opacity = '0';
              }
            }, 3000);

          } else {
            const widget = widgets.get(clientId);
            if (widget) {
              if (widget.fadeTimeout) clearTimeout(widget.fadeTimeout);
              editor.removeContentWidget(widget);
              widgets.delete(clientId);
            }
          }
        });

        // Cleanup disconnected users
        widgets.forEach((widget, clientId) => {
          if (!states.has(clientId)) {
            if (widget.fadeTimeout) clearTimeout(widget.fadeTimeout);
            editor.removeContentWidget(widget);
            widgets.delete(clientId);
          }
        });
      };

      awarenessRef.current.on('update', updateCursors);
      
      // Also update cursors when text changes to prevent race conditions 
      // where awareness arrives before the text sync
      const disposable = editor.onDidChangeModelContent(() => {
        updateCursors();
      });

      // Cleanup
      const originalDispose = bindingRef.current.destroy.bind(bindingRef.current);
      bindingRef.current.destroy = () => {
        disposable.dispose();
        originalDispose();
      };
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    if (socketRef.current) {
      socketRef.current.emit('editor:language_change', { roomId, language: newLang });
    }
  };

  // Cleaned up old checkCursors logic that was incompatible with Monaco v0.56

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Editor Header */}
      <div className="h-12 bg-gray-900 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-white/5">
            <Languages className="w-4 h-4 text-indigo-400" />
            <select 
              value={language}
              onChange={handleLanguageChange}
              className="bg-transparent border-none text-sm font-medium text-gray-200 focus:ring-0 cursor-pointer outline-none appearance-none pr-4"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang} value={lang} className="bg-gray-900">{lang}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
          Live Sync
        </div>
      </div>
      
      {/* Editor Content */}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 16,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            wordWrap: 'on',
            lineNumbersMinChars: 3,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            formatOnPaste: true,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
          }}
          onMount={handleEditorDidMount}
          loading={
            <div className="flex h-full items-center justify-center bg-gray-950">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <span className="text-sm text-gray-500 font-medium">Initializing Editor...</span>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
};
