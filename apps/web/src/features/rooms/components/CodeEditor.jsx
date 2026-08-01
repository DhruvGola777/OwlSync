import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { socketService } from '../../../services/socket';
import { api } from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';
import * as awarenessProtocol from 'y-protocols/awareness';
import { formatDistanceToNow } from 'date-fns';

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

const lastLogTimeMap = {};

export const CodeEditor = ({ roomId, projectId, activeFile }) => {
  const { user } = useAuth();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const yDocRef = useRef(null);
  const awarenessRef = useRef(null);
  const bindingRef = useRef(null);
  const socketRef = useRef(null);
  const latestFileRef = useRef(activeFile);
  const [cursorStyles, setCursorStyles] = useState('');

  useEffect(() => {
    latestFileRef.current = activeFile;
  }, [activeFile]);

  // Initialize socket and Yjs doc (Shared across all files in the room)
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const doc = new Y.Doc();
    yDocRef.current = doc;

    const awareness = new awarenessProtocol.Awareness(doc);
    awarenessRef.current = awareness;

    const userName = user?.name || user?.username || 'Anonymous';
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#0ea5e9'];
    const hashCode = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      return hash;
    };
    const userColor = user?.id ? colors[Math.abs(hashCode(user.id)) % colors.length] : colors[0];
    
    awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
      avatarUrl: user?.avatarUrl,
      id: user?.id,
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

    const updateCursorStyles = () => {
      const states = awareness.getStates();
      // Base styles for y-monaco
      let css = `
        .yRemoteSelection {
          background-color: rgba(250, 129, 0, 0.2);
        }
        .yRemoteSelectionHead {
          position: absolute;
          border-left: orange solid 2px;
          height: 100%;
          box-sizing: border-box;
          z-index: 9;
        }
      `;
      
      states.forEach((state, clientId) => {
        if (clientId !== doc.clientID) {
          const color = state.user?.color || '#ff8800';
          const name = state.user?.name || 'Anonymous';
          css += `
            .yRemoteSelection-${clientId} {
              background-color: ${color}40 !important;
            }
            .yRemoteSelectionHead-${clientId} {
              position: absolute;
              border-left: ${color} solid 2px !important;
              box-sizing: border-box;
              height: 100%;
              display: inline-block;
              z-index: 9;
            }
            .yRemoteSelectionHead-${clientId}::after {
              position: absolute;
              content: '${name}';
              background-color: ${color};
              color: white;
              font-size: 11px;
              font-family: sans-serif;
              font-weight: 500;
              padding: 1px 5px;
              border-radius: 4px;
              border-bottom-left-radius: 0;
              left: -2px;
              top: -18px;
              white-space: nowrap;
              z-index: 100;
              pointer-events: none;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
          `;
        }
      });
      setCursorStyles(css);
    };

    awareness.on('update', ({ added, updated, removed }, origin) => {
      if (origin !== socket && roomId) {
        const changedClients = added.concat(updated).concat(removed);
        const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
        socket.emit('editor:awareness', { roomId, update: Array.from(update) });
      }
    });

    awareness.on('change', () => {
      updateCursorStyles();
    });
    
    // Initial call
    updateCursorStyles();

    return () => {
      if (roomId) {
        socket.off('editor:sync', handleSync);
        socket.off('editor:update', handleUpdate);
        socket.off('editor:awareness', handleAwarenessUpdate);
        socket.off('editor:request_awareness', handleRequestAwareness);
      }
      if (bindingRef.current) bindingRef.current.destroy();
      awareness.destroy();
      doc.destroy();
    };
  }, [roomId, user]);

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
      if (type.toString() === '' && fileContent) {
        type.insert(0, fileContent);
      }
      
      bindingRef.current = new MonacoBinding(
        type, 
        editor.getModel(), 
        new Set([editor]),
        awarenessRef.current
      );
    };

    // Initial binding
    if (activeFile) {
      bindEditor(activeFile.id, activeFile.content);
    }

    // Listen for model changes (when path prop changes)
    editor.onDidChangeModel(() => {
      // We need the current activeFile. We can use a ref to always get the latest.
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

  if (!activeFile) return null;

  return (
    <div className="h-full w-full relative bg-[#1e1e1e]">
      <style dangerouslySetInnerHTML={{ __html: cursorStyles + `
        .monaco-editor .cursor {
          background-color: #d4d4d4 !important;
          border-color: #d4d4d4 !important;
          color: #d4d4d4 !important;
          visibility: visible !important;
        }
      `}} />
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
    </div>
  );
};
