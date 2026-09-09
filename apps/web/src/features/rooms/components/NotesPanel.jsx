import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { socketService } from '../../../services/socket';
import { useAuth } from '../../../providers/AuthProvider';
import * as awarenessProtocol from 'y-protocols/awareness';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VscEdit, VscPreview, VscClose } from 'react-icons/vsc';
import { api } from '../../../services/api';

export const NotesPanel = ({ projectId, isProjectMode, onClose }) => {
  const { user } = useAuth();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const yDocRef = useRef(null);
  const awarenessRef = useRef(null);
  const bindingRef = useRef(null);
  const socketRef = useRef(null);

  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const [content, setContent] = useState('# Project Notes');
  const [loading, setLoading] = useState(true);

  // Initialize socket and Yjs doc for Notes
  useEffect(() => {
    let doc;
    const initNotes = async () => {
      try {
        const socket = socketService.getSocket();
        
        doc = new Y.Doc();
        yDocRef.current = doc;

        const awareness = new awarenessProtocol.Awareness(doc);
        awarenessRef.current = awareness;

        const userName = user?.name || user?.username || 'Anonymous';
        const userColor = user?.id ? `#${user.id.substring(0, 6)}` : '#10b981';
        
        awareness.setLocalStateField('user', {
          name: userName,
          color: userColor,
        });

        // Setup Yjs Doc updates to React state for preview
        doc.getText('monaco').observe(() => {
          setContent(doc.getText('monaco').toString());
        });

        // Sync with socket if in Room Mode
        if (!isProjectMode && socket) {
          socketRef.current = socket;
          socket.emit('notes:join', { projectId });

          const handleSync = ({ update }) => {
            Y.applyUpdate(doc, new Uint8Array(update), 'remote');
            const localAwareness = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]);
            socket.emit('notes:awareness', { projectId, update: Array.from(localAwareness) });
            socket.emit('notes:request_awareness', { projectId });
          };

          const handleUpdate = ({ update }) => {
            Y.applyUpdate(doc, new Uint8Array(update), 'remote');
          };

          const handleAwarenessUpdate = ({ update }) => {
            awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(update), socket);
          };

          const handleRequestAwareness = () => {
            const localAwareness = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]);
            socket.emit('notes:awareness', { projectId, update: Array.from(localAwareness) });
          };

          socket.on('notes:sync', handleSync);
          socket.on('notes:update', handleUpdate);
          socket.on('notes:awareness', handleAwarenessUpdate);
          socket.on('notes:request_awareness', handleRequestAwareness);

          doc.on('update', (update, origin) => {
            if (origin !== 'remote') {
              socket.emit('notes:update', { projectId, update: Array.from(update) });
            }
          });

          awareness.on('update', ({ added, updated, removed }, origin) => {
            if (origin !== socket) {
              const changedClients = added.concat(updated).concat(removed);
              const localAwareness = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
              socket.emit('notes:awareness', { projectId, update: Array.from(localAwareness) });
            }
          });
        } else {
          // Solo mode: just fetch the initial note from API
          try {
            const res = await api.getNote(projectId);
            if (res && res.content) {
              doc.getText('monaco').insert(0, res.content);
            }
          } catch (e) {
            console.error('Failed to load notes in solo mode', e);
          }
          
          // Debounce manual saves in solo mode
          let timeout;
          doc.on('update', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              api.updateNote(projectId, doc.getText('monaco').toString());
            }, 3000);
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      initNotes();
    }

    return () => {
      if (bindingRef.current) bindingRef.current.destroy();
      if (yDocRef.current) yDocRef.current.destroy();
      if (awarenessRef.current) awarenessRef.current.destroy();
      const socket = socketRef.current;
      if (socket && !isProjectMode) {
        socket.off('notes:sync');
        socket.off('notes:update');
        socket.off('notes:awareness');
        socket.off('notes:request_awareness');
      }
    };
  }, [projectId, isProjectMode, user]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme('owl-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#252526',
        'editor.marginBackground': '#252526',
      }
    });
    monaco.editor.setTheme('owl-theme');

    if (yDocRef.current && awarenessRef.current) {
      const type = yDocRef.current.getText('monaco');
      
      // Cleanup previous binding if exists
      if (bindingRef.current) {
        bindingRef.current.destroy();
      }

      bindingRef.current = new MonacoBinding(
        type,
        editor.getModel(),
        new Set([editor]),
        awarenessRef.current
      );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#252526] w-full shrink-0 items-center justify-center text-gray-400">
        Loading notes...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#252526] w-full shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
        <h3 className="font-semibold text-gray-200">Shared Notes</h3>
        <div className="flex items-center space-x-2">
          <div className="flex bg-white/5 rounded p-0.5">
            <button 
              onClick={() => setMode('edit')}
              className={`p-1.5 rounded transition-colors flex items-center justify-center ${mode === 'edit' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              title="Edit Mode"
            >
              <VscEdit className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setMode('preview')}
              className={`p-1.5 rounded transition-colors flex items-center justify-center ${mode === 'preview' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              title="Preview Mode"
            >
              <VscPreview className="w-4 h-4" />
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Close Notes"
            >
              <VscClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        {mode === 'edit' ? (
          <Editor
            height="100%"
            language="markdown"
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              lineNumbers: 'off',
              folding: false,
              padding: { top: 16 },
              fontSize: 14,
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              renderWhitespace: 'none',
              contextmenu: false,
              hover: { enabled: false },
            }}
            onMount={handleEditorDidMount}
          />
        ) : (
          <div className="h-full overflow-y-auto p-4 text-gray-300 markdown-preview prose prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
