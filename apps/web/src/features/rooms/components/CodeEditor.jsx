import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { socketService } from '../../../services/socket';
import { Languages } from 'lucide-react';

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'html', 'css', 'rust', 'go', 'json', 'cpp', 'java'];

export const CodeEditor = ({ roomId, initialLanguage = 'javascript' }) => {
  const [language, setLanguage] = useState(initialLanguage);
  const editorRef = useRef(null);
  const yDocRef = useRef(null);
  const bindingRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const doc = new Y.Doc();
    yDocRef.current = doc;

    socket.emit('editor:join', { roomId });

    const handleSync = ({ update }) => {
      Y.applyUpdate(doc, new Uint8Array(update));
    };

    const handleUpdate = ({ update }) => {
      // When remote update arrives, apply it. This won't trigger another broadcast
      // because we differentiate origin below.
      Y.applyUpdate(doc, new Uint8Array(update));
    };

    const handleLangChange = ({ language: newLang }) => {
      setLanguage(newLang);
    };

    socket.on('editor:sync', handleSync);
    socket.on('editor:update', handleUpdate);
    socket.on('editor:language_change', handleLangChange);

    // Listen to local document changes and broadcast them
    doc.on('update', (update, origin) => {
      // Only broadcast if the update originated locally (from the MonacoBinding or local code)
      // Usually, when `applyUpdate` is called, the origin is null or undefined.
      // MonacoBinding uses itself as the origin.
      if (origin !== null) {
        socket.emit('editor:update', { roomId, update: Array.from(update) });
      }
    });

    return () => {
      socket.off('editor:sync', handleSync);
      socket.off('editor:update', handleUpdate);
      socket.off('editor:language_change', handleLangChange);
      if (bindingRef.current) bindingRef.current.destroy();
      doc.destroy();
    };
  }, [roomId]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    if (yDocRef.current) {
      const type = yDocRef.current.getText('monaco');
      // Create a binding between Yjs type and Monaco model
      bindingRef.current = new MonacoBinding(
        type, 
        editor.getModel(), 
        new Set([editor])
      );
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    if (socketRef.current) {
      socketRef.current.emit('editor:language_change', { roomId, language: newLang });
    }
  };

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
