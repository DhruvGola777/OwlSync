import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { VscClose, VscTrash, VscTerminal } from 'react-icons/vsc';
import { socketService } from '../../../services/socket';

export const TerminalPanel = ({ projectId, isProjectMode, onClose }) => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    let socket;
    
    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#3a3d41',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      padding: 12,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
    }

    if (!isProjectMode) {
      socket = socketService.getSocket();
      if (socket) {
        // Handle input from the user (typing in terminal)
        term.onData((data) => {
          socket.emit('terminal:data', { projectId, data });
        });

        // Handle output from the backend
        const handleTerminalOutput = ({ data }) => {
          term.write(data);
        };

        const handleTerminalReady = () => {
          setStatus('connected');
          term.writeln('\x1b[32mEnvironment ready.\x1b[0m');
          fitAddon.fit();
          socket.emit('terminal:resize', {
            projectId,
            cols: term.cols,
            rows: term.rows
          });
        };

        const handleTerminalError = ({ error }) => {
          setStatus('error');
          term.writeln(`\r\n\x1b[31mTerminal Error: ${error}\x1b[0m`);
        };

        socket.on('terminal:output', handleTerminalOutput);
        socket.on('terminal:ready', handleTerminalReady);
        socket.on('terminal:error', handleTerminalError);

        // Request to start terminal
        setStatus('connecting');
        term.writeln('\x1b[36mProvisioning execution environment...\x1b[0m');
        
        socket.emit('terminal:start', { 
          projectId, 
          cols: term.cols, 
          rows: term.rows 
        });

        const handleResize = () => {
          try {
            fitAddon.fit();
            socket.emit('terminal:resize', {
              projectId,
              cols: term.cols,
              rows: term.rows
            });
          } catch (e) {}
        };

        window.addEventListener('resize', handleResize);

        // Initial fit after a tiny delay to ensure container is sized
        const timer = setTimeout(() => {
          try {
            fitAddon.fit();
            if (term.cols && term.rows) {
              socket.emit('terminal:resize', {
                projectId,
                cols: term.cols,
                rows: term.rows
              });
            }
          } catch (e) {}
        }, 120);

        return () => {
          clearTimeout(timer);
          socket.off('terminal:output', handleTerminalOutput);
          socket.off('terminal:ready', handleTerminalReady);
          socket.off('terminal:error', handleTerminalError);
          window.removeEventListener('resize', handleResize);
          term.dispose();
        };
      }
    } else {
      term.writeln('\x1b[33mTerminal is not available in read-only project mode.\x1b[0m');
      setStatus('disabled');
      return () => term.dispose();
    }

  }, [projectId, isProjectMode]);

  const handleClearTerminal = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] relative select-none">
      <style>{`
        .xterm-viewport::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .xterm-viewport::-webkit-scrollbar-track {
          background: #1e1e1e;
        }
        .xterm-viewport::-webkit-scrollbar-thumb {
          background: #424242;
          border: 2px solid #1e1e1e;
          border-radius: 5px;
        }
        .xterm-viewport::-webkit-scrollbar-thumb:hover {
          background: #4f4f4f;
        }
      `}</style>
      
      {/* Terminal Top Control Bar */}
      <div className="flex items-center justify-between h-[34px] px-3 bg-[#1e1e1e] border-b border-white/10 shrink-0 text-xs select-none">
        {/* Left Side: Terminal Tab & Status */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-gray-200 font-semibold tracking-wider uppercase border-b-2 border-indigo-500 pb-0.5 pt-0.5">
            <VscTerminal className="w-4 h-4 text-indigo-400" />
            <span className="text-[12px]">TERMINAL</span>
          </div>

          <div className="h-3.5 w-[1px] bg-white/10" />

          {/* Connection Status Badge */}
          {status === 'connected' && (
            <span className="inline-flex items-center text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
              Environment Ready
            </span>
          )}
          {status === 'connecting' && (
            <span className="inline-flex items-center text-[11px] text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5 animate-ping" />
              Connecting...
            </span>
          )}
          {status === 'error' && (
            <span className="inline-flex items-center text-[11px] text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5" />
              Disconnected
            </span>
          )}
          {status === 'disabled' && (
            <span className="inline-flex items-center text-[11px] text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5" />
              Read-Only
            </span>
          )}
        </div>

        {/* Right Side: Action Buttons (Clear, Close) */}
        <div className="flex items-center space-x-1">
          {/* Clear Terminal */}
          <button
            onClick={handleClearTerminal}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Clear Terminal Output"
          >
            <VscTrash className="w-4 h-4" />
          </button>

          {/* Close / Cross Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors ml-1"
              title="Close Terminal Panel"
            >
              <VscClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Viewport */}
      <div 
        ref={terminalRef} 
        className="flex-1 w-full h-full overflow-hidden" 
        style={{ padding: '6px 8px 8px 8px' }}
      />
    </div>
  );
};
