import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { socketService } from '../../../services/socket';

export const TerminalPanel = ({ projectId, isProjectMode }) => {
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
      padding: 15,
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
          fitAddon.fit();
          socket.emit('terminal:resize', {
            projectId,
            cols: term.cols,
            rows: term.rows
          });
        };

        window.addEventListener('resize', handleResize);

        // Initial fit after a tiny delay to ensure container is sized
        setTimeout(() => {
          fitAddon.fit();
          if (term.cols && term.rows) {
             socket.emit('terminal:resize', {
               projectId,
               cols: term.cols,
               rows: term.rows
             });
          }
        }, 100);

        return () => {
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

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] relative">
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
      {status === 'connecting' && (
        <div className="absolute top-2 right-4 text-xs text-indigo-400 animate-pulse z-10 font-mono">
          Connecting...
        </div>
      )}
      <div 
        ref={terminalRef} 
        className="flex-1 w-full h-full overflow-hidden" 
        style={{ padding: '8px' }}
      />
    </div>
  );
};
