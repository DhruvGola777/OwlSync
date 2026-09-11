import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { useAuth } from '../../../providers/AuthProvider';
import { 
  VscFiles, VscSearch, VscSourceControl, VscSettingsGear, VscBroadcast,
  VscCheckAll, VscBell, VscError, VscWarning, VscCommentDiscussion, VscOrganization, VscSignOut, VscNotebook, VscEdit, VscHistory, VscPlay, VscClose
} from 'react-icons/vsc';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';
import { ChatPanel } from '../components/ChatPanel';
import { NotesPanel } from '../components/NotesPanel';
import { WhiteboardPanel } from '../components/WhiteboardPanel';
import { TimelinePanel } from '../components/TimelinePanel';
import { CodeEditor } from '../components/CodeEditor';
import { FileExplorer } from '../components/FileExplorer';
import { SearchPanel } from '../components/SearchPanel';
import { SourceControlPanel } from '../components/SourceControlPanel';
import { EditorTabs } from '../components/EditorTabs';
import { TerminalPanel } from '../components/TerminalPanel';
import { AIPanel } from '../components/AIPanel';
import { MembersPanel } from '../components/MembersPanel';
import { VoiceControlBar } from '../components/VoiceControlBar';
import { RecordingModal } from '../components/RecordingModal';
import { useVoiceRoom } from '../hooks/useVoiceRoom';
import { useSessionRecorder } from '../hooks/useSessionRecorder';
import { Sparkles, Film, StopCircle, BarChart3 } from 'lucide-react';
import { AnalyticsModal } from '../../analytics/components/AnalyticsModal';

export const RoomView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  
  const isProjectMode = location.pathname.startsWith('/project');
  
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // WebRTC Voice & Session Screen Recorder Hooks
  const voice = useVoiceRoom(isProjectMode ? null : id, user);
  const recorder = useSessionRecorder(voice.localStream);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  
  // VS Code Layout State
  const [activityBarTab, setActivityBarTab] = useState('explorer'); // 'explorer', 'search'
  const [rightPanel, setRightPanel] = useState('none'); // 'chat', 'members', 'timeline', 'ai', 'none'
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [selectedCode, setSelectedCode] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState('terminal');
  const [pendingDiff, setPendingDiff] = useState(null);
  const [aiEditHistory, setAiEditHistory] = useState([]);

  const handleAcceptDiff = async (diff) => {
    const diffToAccept = diff || pendingDiff;
    if (!diffToAccept) return;
    const targetProjId = isProjectMode ? id : room?.project?.id;
    const targetFile = openFiles.find(f => f.id === diffToAccept.fileId || f.path === diffToAccept.filePath || (f.name && diffToAccept.filePath?.endsWith(f.name)));
    
    if (targetFile && targetProjId) {
      try {
        const prevContent = diffToAccept.originalContent !== undefined ? diffToAccept.originalContent : targetFile.content;
        await api.updateFile(targetProjId, targetFile.id, diffToAccept.newContent);

        // Record undo snapshot in aiEditHistory
        const snapshot = {
          id: 'ai-snap-' + Date.now(),
          fileId: targetFile.id,
          filePath: targetFile.path,
          fileName: targetFile.name,
          previousContent: prevContent,
          newContent: diffToAccept.newContent,
          timestamp: new Date()
        };
        setAiEditHistory(prev => [snapshot, ...prev]);

        setOpenFiles(prev => prev.map(f => f.id === targetFile.id ? { ...f, content: diffToAccept.newContent, updatedAt: new Date() } : f));
        if (!isProjectMode) {
          socketService.notifyFilesChanged(room.id);
        }
      } catch (err) {
        console.error('Failed to accept diff:', err);
      }
    }
    setPendingDiff(null);
  };

  const handleRejectDiff = async (diff) => {
    const diffToReject = diff || pendingDiff;
    if (!diffToReject) return;
    const targetProjId = isProjectMode ? id : room?.project?.id;
    const targetFile = openFiles.find(f => f.id === diffToReject.fileId || f.path === diffToReject.filePath || (f.name && diffToReject.filePath?.endsWith(f.name)));
    
    if (targetFile && targetProjId && diffToReject.originalContent !== undefined) {
      try {
        await api.updateFile(targetProjId, targetFile.id, diffToReject.originalContent);
        setOpenFiles(prev => prev.map(f => f.id === targetFile.id ? { ...f, content: diffToReject.originalContent, updatedAt: new Date() } : f));
        if (!isProjectMode) {
          socketService.notifyFilesChanged(room.id);
        }
      } catch (err) {
        console.error('Failed to revert rejected diff:', err);
      }
    }
    setPendingDiff(null);
  };

  const handleRollback = async (snapshotOrFileId) => {
    const snapshot = typeof snapshotOrFileId === 'object' && snapshotOrFileId?.fileId
      ? snapshotOrFileId
      : aiEditHistory.find(h => h.fileId === snapshotOrFileId || h.id === snapshotOrFileId);

    if (!snapshot) return false;
    const targetProjId = isProjectMode ? id : room?.project?.id;
    if (!targetProjId) return false;

    try {
      await api.updateFile(targetProjId, snapshot.fileId, snapshot.previousContent);
      setOpenFiles(prev => prev.map(f => f.id === snapshot.fileId ? { ...f, content: snapshot.previousContent, updatedAt: new Date() } : f));
      setRoom(prev => {
        if (!prev?.project?.files) return prev;
        return {
          ...prev,
          project: {
            ...prev.project,
            files: prev.project.files.map(f => f.id === snapshot.fileId ? { ...f, content: snapshot.previousContent, updatedAt: new Date() } : f)
          }
        };
      });

      // Remove snapshot from history once rolled back
      setAiEditHistory(prev => prev.filter(h => h.id !== snapshot.id));

      if (!isProjectMode) {
        socketService.notifyFilesChanged(room.id);
      }
      return true;
    } catch (err) {
      console.error('Failed to rollback AI changes:', err);
      return false;
    }
  };
  
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('owlsync_sidebar_width');
    return saved ? parseInt(saved, 10) : 256;
  });
  
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
    const saved = localStorage.getItem('owlsync_bottom_panel_height');
    return saved ? parseInt(saved, 10) : 256;
  });

  useEffect(() => {
    localStorage.setItem('owlsync_sidebar_width', sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('owlsync_bottom_panel_height', bottomPanelHeight);
  }, [bottomPanelHeight]);

  const activeSidebarRef = useRef(rightPanel);

  const toggleActivityBarTab = (tab) => {
    setActivityBarTab(prev => prev === tab ? 'none' : tab);
  };

  const toggleRightPanel = (panel) => {
    setRightPanel(prev => prev === panel ? 'none' : panel);
  };

  const handleSidebarResizeMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    
    const onMouseMove = (moveEvent) => {
      const newWidth = Math.min(Math.max(150, startWidth + (moveEvent.clientX - startX)), 600);
      setSidebarWidth(newWidth);
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleBottomPanelResizeMouseDown = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;
    
    const onMouseMove = (moveEvent) => {
      const newHeight = Math.min(Math.max(100, startHeight - (moveEvent.clientY - startY)), 800);
      setBottomPanelHeight(newHeight);
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'row-resize';
  };

  useEffect(() => {
    activeSidebarRef.current = rightPanel;
    if (rightPanel === 'chat') {
      setUnreadCount(0);
    }
  }, [rightPanel]);

  useEffect(() => {
    const handleClick = () => setShowSettingsMenu(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleCreateFile = async (data) => {
    if (!room?.project?.id) return;
    try {
      const newFile = await api.createFile(room.project.id, data);
      setRoom(prev => ({
        ...prev,
        project: {
          ...prev.project,
          files: [...prev.project.files, newFile]
        }
      }));
      if (newFile.name !== '.keep') {
        handleFileSelect(newFile);
      }
      
      const userName = user?.name || user?.username || 'Someone';
      const isFolder = data.name.endsWith('/') || data.path?.endsWith('.keep');
      const itemTitle = isFolder ? `folder ${data.name.replace(/\/$/, '')}` : data.name;
      api.createActivity(room.project.id, {
        type: isFolder ? 'FOLDER_CREATED' : 'FILE_CREATED',
        description: `${userName} created ${itemTitle}`,
        metadata: { path: data.path || data.name }
      }).then(activity => {
        const socket = socketService.getSocket();
        if (socket && activity) {
          socket.emit('project:activity:new', { projectId: room.project.id, activity });
        }
      }).catch(console.error);

      if (!isProjectMode) {
        socketService.notifyFilesChanged(room.id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRenameFile = async (node, newName) => {
    if (!room?.project?.id) return;
    try {
      const oldPath = node.path;
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      await api.renameFileOrFolder(room.project.id, oldPath, newPath);

      setRoom(prev => {
        const updatedFiles = prev.project.files.map(f => {
          if (f.path.startsWith(oldPath)) {
            return {
              ...f,
              path: newPath + f.path.slice(oldPath.length),
              name: f.path === oldPath ? newName : f.name
            };
          }
          return f;
        });
        return { ...prev, project: { ...prev.project, files: updatedFiles } };
      });

      setOpenFiles(prev => prev.map(f => {
         if (f.path.startsWith(oldPath)) {
           return {
              ...f,
              path: newPath + f.path.slice(oldPath.length),
              name: f.path === oldPath ? newName : f.name
           }
         }
         return f;
      }));

      const userName = user?.name || user?.username || 'Someone';
      api.createActivity(room.project.id, {
        type: 'FILE_RENAMED',
        description: `${userName} renamed ${oldPath.split('/').pop()} to ${newName}`,
        metadata: { oldPath, newPath }
      }).then(activity => {
        const socket = socketService.getSocket();
        if (socket && activity) {
          socket.emit('project:activity:new', { projectId: room.project.id, activity });
        }
      }).catch(console.error);

      if (!isProjectMode) {
        socketService.notifyFilesChanged(room.id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteFile = async (node) => {
    if (!room?.project?.id) return;
    try {
      await api.deleteFileOrFolder(room.project.id, node.path);
      
      const deletedIds = room.project.files.filter(f => f.path.startsWith(node.path)).map(f => f.id);
      
      setRoom(prev => ({
        ...prev,
        project: {
          ...prev.project,
          files: prev.project.files.filter(f => !f.path.startsWith(node.path))
        }
      }));

      const newOpenFiles = openFiles.filter(f => !deletedIds.includes(f.id));
      setOpenFiles(newOpenFiles);
      if (deletedIds.includes(activeFileId)) {
        setActiveFileId(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].id : null);
      }

      const userName = user?.name || user?.username || 'Someone';
      const isFolder = node.type === 'folder';
      api.createActivity(room.project.id, {
        type: isFolder ? 'FOLDER_DELETED' : 'FILE_DELETED',
        description: `${userName} deleted ${isFolder ? 'folder ' + node.name : node.name}`,
        metadata: { path: node.path }
      }).then(activity => {
        const socket = socketService.getSocket();
        if (socket && activity) {
          socket.emit('project:activity:new', { projectId: room.project.id, activity });
        }
      }).catch(console.error);

      if (!isProjectMode) {
        socketService.notifyFilesChanged(room.id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMoveFile = async (oldPath, newPath, sourceName, targetFolderName) => {
    if (!room?.project?.id) return;
    try {
      await api.renameFileOrFolder(room.project.id, oldPath, newPath);

      setRoom(prev => {
        const updatedFiles = prev.project.files.map(f => {
          if (f.path.startsWith(oldPath)) {
            return {
              ...f,
              path: newPath + f.path.slice(oldPath.length),
              name: f.path === oldPath ? newPath.split('/').pop() : f.name
            };
          }
          return f;
        });
        return { ...prev, project: { ...prev.project, files: updatedFiles } };
      });

      setOpenFiles(prev => prev.map(f => {
        if (f.path.startsWith(oldPath)) {
          return {
            ...f,
            path: newPath + f.path.slice(oldPath.length),
            name: f.path === oldPath ? newPath.split('/').pop() : f.name
          };
        }
        return f;
      }));

      const userName = user?.name || user?.username || 'Someone';
      api.createActivity(room.project.id, {
        type: 'FILE_RENAMED',
        description: `${userName} moved ${sourceName} into ${targetFolderName}`,
        metadata: { oldPath, newPath }
      }).then(activity => {
        const socket = socketService.getSocket();
        if (socket && activity) {
          socket.emit('project:activity:new', { projectId: room.project.id, activity });
        }
      }).catch(console.error);

      if (!isProjectMode) {
        socketService.notifyFilesChanged(room.id);
      }
    } catch (err) {
      console.error('Failed to move file:', err);
      alert(err.message || 'Failed to move file');
    }
  };

  const handleFileSelect = (file) => {
    if (!openFiles.find(f => f.id === file.id)) {
      setOpenFiles([...openFiles, file]);
    }
    setActiveFileId(file.id);
  };

  const handleTabClose = (fileId) => {
    const newOpenFiles = openFiles.filter(f => f.id !== fileId);
    setOpenFiles(newOpenFiles);
    if (activeFileId === fileId) {
      setActiveFileId(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].id : null);
    }
  };

  useEffect(() => {
    let socket;
    const fetchRoomAndConnect = async () => {
      try {
        if (isProjectMode) {
          const project = await api.getProject(id);
          setRoom({ id: null, name: project.name, project: project, members: [] });
          setLoading(false);
          return;
        }

        const res = await api.getRoom(id);
        let fetchedRoom = res.room;
        
        const isMember = fetchedRoom.members.some(m => m.user.id === user?.id);

        if (!isMember) {
          if (fetchedRoom.isProtected) {
            alert("This room is password protected. Please join from the dashboard.");
            navigate('/');
            return;
          } else {
            try {
              await api.joinRoom(id, '');
              const updatedRes = await api.getRoom(id);
              fetchedRoom = updatedRes.room;
            } catch (joinErr) {
              console.error('Failed to auto-join public room', joinErr);
              alert(joinErr.message || 'Failed to join room');
              navigate('/');
              return;
            }
          }
        }

        setRoom(fetchedRoom);
        if (user?.id) {
          setActiveUsers(prev => [...new Set([...prev, user.id])]);
        }
        socket = socketService.connect(token);
        
        const handleJoin = () => socketService.joinRoom(id);
        if (socket.connected) handleJoin();
        socket.on('connect', handleJoin);
        socket.on('reconnect', handleJoin);

        socket.on('room:active_users', ({ activeUsers }) => {
          setActiveUsers(prev => {
            const list = activeUsers || [];
            if (user?.id && !list.includes(user.id)) {
              return [...list, user.id];
            }
            return list;
          });
        });
        socket.on('room:user_joined', async ({ userId }) => {
          setActiveUsers(prev => [...new Set([...prev, userId])]);
          try {
            const updatedRes = await api.getRoom(id);
            setRoom(updatedRes.room);
          } catch (e) {
            console.error('Error refetching room on user join', e);
          }
        });
        socket.on('room:user_left', ({ userId }) => setActiveUsers(prev => prev.filter(uid => uid !== userId)));
        socket.on('room:kicked', () => { alert('You have been kicked from the room.'); navigate('/'); });
        socket.on('room:role_changed', ({ targetUserId, role }) => {
          setRoom(prev => {
            if (!prev || !prev.members) return prev;
            return {
              ...prev,
              members: prev.members.map(m => (m.userId === targetUserId || m.user?.id === targetUserId) ? { ...m, role } : m)
            };
          });
        });
        socket.on('chat:new_message', () => {
          if (activeSidebarRef.current !== 'chat') setUnreadCount(prev => prev + 1);
        });
        socket.on('project:files_changed', async () => {
          try {
            const updatedRes = await api.getRoom(id);
            setRoom(updatedRes.room);
            // Could also close tabs if deleted, but re-fetching room is good enough for MVP sync
          } catch (e) {
            console.error('Error refetching room for files sync', e);
          }
        });

      } catch (err) {
        console.error('Failed to load:', err);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomAndConnect();

    return () => {
      if (socket) {
        socketService.leaveRoom(id);
        socket.off('room:active_users');
        socket.off('room:user_joined');
        socket.off('room:user_left');
        socket.off('room:kicked');
        socket.off('chat:new_message');
        socket.off('project:files_changed');
      }
    };
  }, [id, navigate, token, isProjectMode, user?.id]);

  if (loading || !room) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e1e1e]">
        <div className="text-[#cccccc]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#252526] text-white font-sans overflow-hidden select-none">
      
      {/* Top Menu Bar */}
      <div className="flex items-center justify-between h-[42px] px-3 bg-[#1e1e1e] shrink-0 border-b border-white/10 select-none z-20 gap-3 relative">
        {/* Left Section: Logo & Menus */}
        <div className="flex items-center space-x-3 min-w-0 shrink-0">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-lg">🦉</span>
            <span className="font-bold text-sm text-white tracking-tight hidden sm:inline">OwlSync</span>
          </div>

          <div className="h-4 w-[1px] bg-white/10 shrink-0" />

          {/* Menus */}
          <div className="flex items-center space-x-3 text-xs font-medium text-gray-400 shrink-0">
            <div className="hover:text-white cursor-pointer transition-colors px-1.5 py-1 rounded hover:bg-white/5">File</div>
            <div className="hover:text-white cursor-pointer transition-colors px-1.5 py-1 rounded hover:bg-white/5">View</div>
            <div 
              className="hover:text-white cursor-pointer transition-colors px-1.5 py-1 rounded hover:bg-white/5 text-indigo-300"
              onClick={() => setShowBottomPanel(!showBottomPanel)}
            >
              Terminal
            </div>
          </div>
        </div>

        {/* Center Section: Room Title & Online Status */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-2 max-w-[280px] sm:max-w-[420px] pointer-events-auto">
          <span className="text-xs font-semibold text-gray-200 truncate" title={room?.name || 'OwlSync Project'}>
            {room?.name || 'OwlSync Project'}
          </span>
          {!isProjectMode && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
              {activeUsers.length} Online
            </span>
          )}
        </div>

        {/* Right Section: Actions & Utilities */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* In-IDE Session Screen Recording Control */}
          {!recorder.isRecording ? (
            <button
              onClick={recorder.startRecording}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-white border border-red-500/30 text-xs font-medium transition-all shadow-sm active:scale-95 shrink-0"
              title="Record IDE Screen & Audio Session"
            >
              <Film className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Record</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2 px-2.5 py-1 bg-red-950/80 border border-red-500/60 rounded-md text-xs text-red-200 shrink-0 shadow-md">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono font-bold text-red-300">REC {recorder.formattedDuration}</span>
              <button
                onClick={recorder.stopRecording}
                className="p-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors ml-1"
                title="Stop Recording"
              >
                <StopCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="h-4 w-[1px] bg-white/10 shrink-0" />

          {/* Analytics & Metrics Modal Trigger */}
          <button
            onClick={() => setShowAnalyticsModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition-all shadow-sm active:scale-95 shrink-0"
            title="Real-time Workspace & Developer Analytics"
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Analytics</span>
          </button>

          <div className="h-4 w-[1px] bg-white/10 shrink-0" />

          {/* Run Code Button */}
          <button 
            onClick={() => {
              const activeFile = openFiles.find(f => f.id === activeFileId);
              if (!activeFile) {
                alert('Please select a file to run.');
                return;
              }

              const isJsTs = activeFile.name.endsWith('.js') || activeFile.name.endsWith('.ts') || activeFile.name.endsWith('.mjs') || activeFile.name.endsWith('.cjs');
              const isPy = activeFile.name.endsWith('.py');
              const isSh = activeFile.name.endsWith('.sh');

              if (isJsTs || isPy || isSh) {
                const socket = socketService.getSocket();
                if (socket) {
                  setShowBottomPanel(true);
                  const relPath = activeFile.path.startsWith('/') ? activeFile.path.slice(1) : activeFile.path;
                  let cmd = `node "${relPath}"`;
                  if (isPy) cmd = `python3 "${relPath}"`;
                  else if (isSh) cmd = `sh "${relPath}"`;

                  socket.emit('terminal:data', { 
                    projectId: room?.project?.id, 
                    data: `${cmd}\r` 
                  });
                }
              } else {
                alert('Please select a JavaScript, TypeScript, Python, or Shell file to run.');
              }
            }}
            className="flex items-center text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-3 py-1.5 rounded-md transition-all shadow-sm shrink-0"
            title="Run Active File in Terminal"
          >
            <VscPlay className="w-3.5 h-3.5 mr-1 shrink-0" />
            <span>Run</span>
          </button>

          <div className="h-4 w-[1px] bg-white/10 shrink-0" />

          {!isProjectMode ? (
            <>
              {/* AI Pair Programmer */}
              <button 
                onClick={() => toggleRightPanel('ai')}
                className={`p-1.5 rounded-md transition-all shrink-0 ${rightPanel === 'ai' ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-amber-400/50' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="OwlSync AI Pair Programmer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
              </button>

              {/* Whiteboard Toggle */}
              <button 
                onClick={() => setShowWhiteboard(prev => !prev)}
                className={`p-1.5 rounded-md transition-all shrink-0 ${showWhiteboard ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Whiteboard Canvas"
              >
                <VscEdit className="w-4 h-4" />
              </button>

              {/* Shared Notes */}
              <button 
                onClick={() => toggleRightPanel('notes')}
                className={`p-1.5 rounded-md transition-all shrink-0 ${rightPanel === 'notes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Shared Notes"
              >
                <VscNotebook className="w-4 h-4" />
              </button>

              {/* Room Chat */}
              <button 
                onClick={() => toggleRightPanel('chat')}
                className={`p-1.5 rounded-md transition-all shrink-0 relative ${rightPanel === 'chat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Room Chat"
              >
                <VscCommentDiscussion className="w-4 h-4" />
                {unreadCount > 0 && rightPanel !== 'chat' && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-[#1e1e1e]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Session Timeline */}
              <button 
                onClick={() => toggleRightPanel('timeline')}
                className={`p-1.5 rounded-md transition-all shrink-0 ${rightPanel === 'timeline' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Session Timeline"
              >
                <VscHistory className="w-4 h-4" />
              </button>

              {/* Participants */}
              <button 
                onClick={() => toggleRightPanel('members')}
                className={`p-1.5 rounded-md transition-all shrink-0 ${rightPanel === 'members' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Room Members"
              >
                <VscOrganization className="w-4 h-4" />
              </button>

              <div className="h-4 w-[1px] bg-white/10 shrink-0" />

              {/* Leave / End Button */}
              <button 
                onClick={async () => {
                  const actionStr = room?.ownerId === user?.id ? "end this session and delete the room" : "leave this room";
                  if (window.confirm(`Are you sure you want to ${actionStr}?`)) {
                    try {
                      if (room?.ownerId === user?.id) {
                        await api.deleteRoom(room.id);
                      } else {
                        await api.leaveRoom(room.id);
                      }
                      navigate('/projects');
                    } catch (err) {
                      console.error("Failed to exit room:", err);
                      alert("Failed to " + actionStr.split(' ')[0] + " room.");
                    }
                  }
                }}
                className="flex items-center text-xs text-red-400 hover:text-white hover:bg-red-600 px-2.5 py-1 rounded-md transition-all border border-red-500/20 hover:border-red-600 shrink-0"
                title={room?.ownerId === user?.id ? "End Session" : "Leave Room"}
              >
                <VscSignOut className="w-3.5 h-3.5 mr-1 shrink-0" />
                <span>{room?.ownerId === user?.id ? "End" : "Leave"}</span>
              </button>
            </>
          ) : (
            <>
              {/* AI Pair Programmer */}
              <button 
                onClick={() => toggleRightPanel('ai')}
                className={`p-1.5 rounded-md transition-all shrink-0 ${rightPanel === 'ai' ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-amber-400/50' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="OwlSync AI Pair Programmer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
              </button>
              <button 
                onClick={() => setShowWhiteboard(prev => !prev)}
                className={`p-1.5 rounded-md transition-all shrink-0 ${showWhiteboard ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Whiteboard Canvas"
              >
                <VscEdit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => toggleRightPanel('notes')}
                className={`p-1.5 rounded-md transition-all shrink-0 ${rightPanel === 'notes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Project Notes"
              >
                <VscNotebook className="w-4 h-4" />
              </button>
              <button 
                onClick={() => toggleRightPanel('timeline')}
                className={`p-1.5 rounded-md transition-all shrink-0 ${rightPanel === 'timeline' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Project Timeline"
              >
                <VscHistory className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate('/projects')}
                className="flex items-center text-xs text-gray-300 hover:text-white hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors border border-white/10 shrink-0"
              >
                <VscSignOut className="w-3.5 h-3.5 mr-1 shrink-0" />
                <span>Close</span>
              </button>
            </>
          )}
        </div>
      </div>

      {showWhiteboard ? (
        <div className="flex-1 w-full h-full relative z-10 bg-[#252526] overflow-hidden flex flex-col">
          <div className="h-9 px-4 bg-[#1e1e1e] border-b border-white/10 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Whiteboard Canvas</span>
            <button 
              onClick={() => setShowWhiteboard(false)}
              className="text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors flex items-center gap-1 font-medium shadow-sm"
            >
              <VscClose className="w-3.5 h-3.5" />
              <span>Back to Editor</span>
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <WhiteboardPanel projectId={isProjectMode ? id : room?.project?.id} isProjectMode={isProjectMode} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Activity Bar (Far Left) */}
        <div className="flex flex-col w-[56px] bg-[#333333] shrink-0 items-center justify-between py-3 border-r border-white/10">
          <div className="flex flex-col space-y-5 w-full items-center">
            <button 
              onClick={() => toggleActivityBarTab('explorer')}
              className={`p-2 relative transition-colors ${activityBarTab === 'explorer' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
            >
              {activityBarTab === 'explorer' && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500"></div>}
              <VscFiles className="w-7 h-7" />
            </button>
            <button 
              onClick={() => toggleActivityBarTab('search')}
              className={`p-2 relative transition-colors ${activityBarTab === 'search' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
              title="Search"
            >
              {activityBarTab === 'search' && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500"></div>}
              <VscSearch className="w-7 h-7" />
            </button>
            <button 
              onClick={() => toggleActivityBarTab('git')}
              className={`p-2 relative transition-colors ${activityBarTab === 'git' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
              title="Source Control (Git)"
            >
              {activityBarTab === 'git' && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500"></div>}
              <VscSourceControl className="w-7 h-7" />
            </button>
          </div>
          <div className="flex flex-col space-y-4 w-full items-center relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(!showSettingsMenu); }}
              className={`p-2 text-gray-400 hover:text-white transition-colors relative ${showSettingsMenu ? 'text-white' : ''}`}
              title="Settings"
            >
              <VscSettingsGear className="w-6 h-6" />
            </button>

            {showSettingsMenu && (
              <div 
                className="absolute left-[60px] bottom-2 w-[220px] bg-[#252526] border border-white/10 shadow-2xl rounded-md py-1 z-50 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <button className="w-full text-left px-4 py-2 text-[13px] text-gray-300 hover:text-white hover:bg-indigo-500 transition-colors flex items-center">
                  Command Palette... <span className="ml-auto text-gray-500 text-[11px]">Ctrl+Shift+P</span>
                </button>
                <button className="w-full text-left px-4 py-2 text-[13px] text-gray-300 hover:text-white hover:bg-indigo-500 transition-colors">
                  Settings
                </button>
                <button className="w-full text-left px-4 py-2 text-[13px] text-gray-300 hover:text-white hover:bg-indigo-500 transition-colors">
                  Keyboard Shortcuts
                </button>
                <div className="h-[1px] bg-white/10 my-1 w-full"></div>
                {!isProjectMode && room && room.ownerId === user?.id && (
                  <button className="w-full text-left px-4 py-2 text-[13px] text-gray-300 hover:text-white hover:bg-indigo-500 transition-colors">
                    Room Settings
                  </button>
                )}
                
                {isProjectMode ? (
                  <button 
                    onClick={() => navigate('/projects')}
                    className="w-full text-left px-4 py-2 text-[13px] text-gray-300 hover:text-white hover:bg-white/10 transition-colors mt-1"
                  >
                    Close Project
                  </button>
                ) : (
                  <button 
                    onClick={async () => {
                      const actionStr = room?.ownerId === user?.id ? "end this session and delete the room" : "leave this room";
                      if (window.confirm(`Are you sure you want to ${actionStr}?`)) {
                        try {
                          if (room?.ownerId === user?.id) {
                            await api.deleteRoom(room.id);
                          } else {
                            await api.leaveRoom(room.id);
                          }
                          navigate('/projects');
                        } catch (err) {
                          console.error("Failed to exit room:", err);
                          alert("Failed to " + actionStr.split(' ')[0] + " room.");
                        }
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-[13px] text-red-400 hover:text-white hover:bg-red-500 transition-colors mt-1"
                  >
                    {room?.ownerId === user?.id ? "End Session" : "Leave Room"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {activityBarTab !== 'none' && room.project && (
          <div 
            className="h-full bg-[#252526] shrink-0 overflow-hidden relative border-r border-white/10"
            style={{ width: `${sidebarWidth}px` }}
          >
            <div 
              className="absolute top-0 right-0 bottom-0 w-[4px] cursor-col-resize hover:bg-indigo-500 z-20 group"
              onMouseDown={handleSidebarResizeMouseDown}
            >
              <div className="w-full h-full opacity-0 group-hover:opacity-100 bg-indigo-500 transition-opacity" />
            </div>

            {activityBarTab === 'explorer' && (
              <FileExplorer 
                projectId={isProjectMode ? id : room.project?.id}
                projectName={room.name}
                files={room.project.files}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
                onCreateFile={handleCreateFile}
                onRenameFile={handleRenameFile}
                onDeleteFile={handleDeleteFile}
                onMoveFile={handleMoveFile}
              />
            )}

            {activityBarTab === 'search' && (
              <SearchPanel 
                files={room.project.files}
                onFileSelect={handleFileSelect}
              />
            )}

            {activityBarTab === 'git' && (
              <SourceControlPanel 
                projectId={isProjectMode ? id : room.project.id}
                projectFiles={room.project.files || openFiles}
                openFiles={openFiles}
                currentUser={user}
                onFileSelect={handleFileSelect}
                onOpenDiff={(change) => {
                  setPendingDiff({
                    fileId: change.file?.id,
                    filePath: change.path,
                    originalContent: change.originalContent,
                    newContent: change.newContent
                  });
                  const targetFile = openFiles.find(f => f.path === change.path || f.id === change.file?.id);
                  if (targetFile && targetFile.id !== activeFileId) {
                    setActiveFileId(targetFile.id);
                  }
                }}
                onRevertFile={async (file, originalContent) => {
                  const targetProjId = isProjectMode ? id : room?.project?.id;
                  if (!targetProjId || !file?.id) return;
                  try {
                    await api.updateFile(targetProjId, file.id, originalContent);
                    setOpenFiles(prev => prev.map(f => f.id === file.id ? { ...f, content: originalContent } : f));
                    setRoom(prev => ({
                      ...prev,
                      project: {
                        ...prev.project,
                        files: prev.project.files.map(f => f.id === file.id ? { ...f, content: originalContent } : f)
                      }
                    }));
                    if (!isProjectMode) {
                      socketService.notifyFilesChanged(room.id);
                    }
                  } catch (err) {
                    console.error('Failed to revert file:', err);
                  }
                }}
                isProjectMode={isProjectMode}
              />
            )}
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#252526] relative">
          {openFiles.length > 0 ? (
            <div className="flex-1 flex flex-col min-h-0 relative">
              <EditorTabs 
                openFiles={openFiles} 
                activeFileId={activeFileId}
                onTabSelect={handleFileSelect}
                onTabClose={handleTabClose}
              />
              <div className="flex-1 min-h-0 relative w-full h-full">
                {(() => {
                  const isRoomOwner = !isProjectMode && room?.ownerId === user?.id;
                  const currentMember = !isProjectMode && room?.members?.find(m => m.userId === user?.id || m.user?.id === user?.id);
                  const currentUserRole = isProjectMode ? 'OWNER' : (isRoomOwner ? 'OWNER' : (currentMember?.role || 'MEMBER'));
                  const isReadOnly = currentUserRole === 'GUEST' || currentUserRole === 'VIEWER';

                  return (
                    <CodeEditor 
                      key={activeFileId}
                      roomId={isProjectMode ? null : room.id} 
                      projectId={isProjectMode ? id : room.project.id}
                      activeFile={openFiles.find(f => f.id === activeFileId)}
                      onSelectionChange={(text) => setSelectedCode(text)}
                      pendingDiff={pendingDiff}
                      onAcceptDiff={handleAcceptDiff}
                      onRejectDiff={handleRejectDiff}
                      aiEditHistory={aiEditHistory}
                      onRollback={handleRollback}
                      isReadOnly={isReadOnly}
                      onOpenAI={(text) => {
                        setSelectedCode(text);
                        setRightPanel('ai');
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center h-full text-gray-400 select-none bg-[#1e1e1e]">
              <VscFiles className="w-32 h-32 text-gray-600 mb-8" />
              <div className="text-2xl mb-5 font-light text-white">OwlSync IDE</div>
              <div className="flex items-center space-x-3 text-[15px]">
                <span>Show All Commands</span>
                <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white">Ctrl+Shift+P</span>
              </div>
              <div className="flex items-center space-x-3 text-[15px] mt-3">
                <span>Go to File</span>
                <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white">Ctrl+P</span>
              </div>
            </div>
          )}
          
          {/* Bottom Panel */}
          {showBottomPanel && (
            <div 
              className="border-t border-white/10 flex flex-col bg-[#1e1e1e] shrink-0 relative"
              style={{ height: `${bottomPanelHeight}px` }}
            >
              <div 
                className="absolute top-0 left-0 right-0 h-[4px] -mt-[2px] cursor-row-resize hover:bg-indigo-500 z-20 group"
                onMouseDown={handleBottomPanelResizeMouseDown}
              >
                <div className="w-full h-full opacity-0 group-hover:opacity-100 bg-indigo-500 transition-opacity" />
              </div>
              <TerminalPanel 
                roomId={isProjectMode ? null : room.id}
                projectId={isProjectMode ? id : room.project?.id}
                isProjectMode={isProjectMode}
                onClose={() => setShowBottomPanel(false)}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar Panels */}
        {rightPanel !== 'none' && (
          <div className="flex flex-col h-full bg-[#252526] w-80 shrink-0 overflow-hidden border-l border-white/10 select-none relative">
            {!isProjectMode && rightPanel === 'members' && (
              <MembersPanel
                roomId={room?.id}
                activeUsers={activeUsers}
                currentUser={user}
                roomOwnerId={room?.ownerId}
                roomMembers={room?.members}
                voice={voice}
                onClose={() => setRightPanel('none')}
              />
            )}

            {!isProjectMode && rightPanel === 'chat' && (
              <div className="flex flex-col h-full bg-[#252526] w-full shrink-0 overflow-hidden">
                <div className="px-4 py-2.5 text-[13px] font-bold text-white tracking-wider uppercase h-[44px] flex items-center justify-between border-b border-white/10 shrink-0 bg-[#1e1e1e]">
                  <span>Room Chat</span>
                  <button
                    onClick={() => setRightPanel('none')}
                    className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Close Chat"
                  >
                    <VscClose className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  <ChatPanel roomId={room.id} onClose={() => setRightPanel('none')} hideHeader={true} />
                </div>
              </div>
            )}

            {rightPanel === 'ai' && (
              <AIPanel 
                projectId={isProjectMode ? id : room?.project?.id}
                roomName={room?.name}
                activeFile={openFiles.find(f => f.id === activeFileId)}
                selectedCode={selectedCode}
                projectFiles={room?.project?.files && room.project.files.length > 0 ? room.project.files : openFiles}
                pendingDiff={pendingDiff}
                aiEditHistory={aiEditHistory}
                onRollback={handleRollback}
                onClose={() => setRightPanel('none')}
                onDiffProposed={(diff) => {
                  setPendingDiff(diff);
                  const targetFile = openFiles.find(f => f.id === diff.fileId || f.path === diff.filePath || (f.name && diff.filePath?.endsWith(f.name)));
                  if (targetFile && targetFile.id !== activeFileId) {
                    setActiveFileId(targetFile.id);
                  }
                }}
                onAcceptDiff={handleAcceptDiff}
                onRejectDiff={handleRejectDiff}
                onApplyCode={async (code, targetFilePath) => {
                  const targetProjId = isProjectMode ? id : room?.project?.id;
                  const targetFile = targetFilePath 
                    ? openFiles.find(f => f.path === targetFilePath || f.name === targetFilePath) || openFiles.find(f => f.id === activeFileId)
                    : openFiles.find(f => f.id === activeFileId);
                  
                  if (targetFile && targetProjId) {
                    try {
                      // Record snapshot before applying code
                      const snapshot = {
                        id: 'ai-snap-' + Date.now(),
                        fileId: targetFile.id,
                        filePath: targetFile.path,
                        fileName: targetFile.name,
                        previousContent: targetFile.content,
                        newContent: code,
                        timestamp: new Date()
                      };
                      setAiEditHistory(prev => [snapshot, ...prev]);

                      await api.updateFile(targetProjId, targetFile.id, code);
                      setOpenFiles(prev => prev.map(f => f.id === targetFile.id ? { ...f, content: code } : f));
                      if (!isProjectMode) {
                        socketService.notifyFilesChanged(room.id);
                      }
                    } catch (err) {
                      console.error('Failed to apply code to file:', err);
                    }
                  }
                }}
                onFilesChanged={async () => {
                  const targetProjId = isProjectMode ? id : room?.project?.id;
                  if (!targetProjId) return;
                  try {
                    const proj = await api.getProject(targetProjId);
                    if (proj?.files) {
                      setRoom(prev => ({
                        ...prev,
                        project: { ...prev.project, files: proj.files }
                      }));
                      setOpenFiles(prev => {
                        return prev.map(of => {
                          const fresh = proj.files.find(f => f.id === of.id || f.path === of.path);
                          return fresh ? { ...of, ...fresh } : of;
                        });
                      });
                    }
                  } catch (e) {
                    console.error('Failed to refresh files after agent action:', e);
                  }
                }}
              />
            )}

            {(isProjectMode ? id : room?.project?.id) && rightPanel === 'notes' && (
              <NotesPanel 
                projectId={isProjectMode ? id : room.project.id} 
                isProjectMode={isProjectMode} 
                onClose={() => setRightPanel('none')} 
              />
            )}

            {(isProjectMode ? id : room?.project?.id) && rightPanel === 'timeline' && (
              <TimelinePanel 
                projectId={isProjectMode ? id : room.project.id} 
                isProjectMode={isProjectMode} 
                onClose={() => setRightPanel('none')} 
              />
            )}
          </div>
        )}
      </div>
      )}
      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between h-[32px] bg-[#252526] border-t border-white/10 text-gray-300 px-4 shrink-0 text-[14px]">
        <div className="flex items-center space-x-5 h-full">
          <div className="flex items-center hover:bg-white/10 hover:text-white transition-colors h-full px-2 cursor-pointer">
            <VscSourceControl className="w-4 h-4 mr-1.5" />
            <span>main*</span>
          </div>
          <div className="flex items-center hover:bg-white/10 hover:text-white transition-colors h-full px-2 cursor-pointer">
            <VscError className="w-4 h-4 mr-1" /> 0
            <VscWarning className="w-4 h-4 ml-3 mr-1" /> 0
          </div>
          {!isProjectMode && (
            <div className="flex items-center hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 transition-colors h-full px-3 cursor-pointer rounded-sm my-1 ml-2">
              <VscBroadcast className="w-4 h-4 mr-1.5" />
              <span className="font-medium">Live Sync ({activeUsers.length})</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-5 h-full">
          <div className="hover:bg-white/10 hover:text-white transition-colors h-full px-3 flex items-center cursor-pointer">Ln 1, Col 1</div>
          <div className="hover:bg-white/10 hover:text-white transition-colors h-full px-3 flex items-center cursor-pointer">UTF-8</div>
          <div className="hover:bg-white/10 hover:text-white transition-colors h-full px-3 flex items-center cursor-pointer">JavaScript</div>
          <div className="hover:bg-white/10 hover:text-white transition-colors h-full px-3 flex items-center cursor-pointer">
            <VscCheckAll className="w-[18px] h-[18px] mr-1.5" /> Prettier
          </div>
          <div className="hover:bg-white/10 hover:text-white transition-colors h-full px-3 flex items-center cursor-pointer">
            <VscBell className="w-4 h-4" />
          </div>
        </div>
      </div>
      
      {/* Session Video Recording Modal Preview & Export */}
      <RecordingModal
        isOpen={recorder.showPreviewModal}
        onClose={() => recorder.setShowPreviewModal(false)}
        blobUrl={recorder.recordedBlobUrl}
        blob={recorder.recordedBlob}
        formattedDuration={recorder.formattedDuration}
        durationSeconds={recorder.recordingSeconds}
        roomId={room?.id}
        projectId={isProjectMode ? id : room?.project?.id}
        roomName={room?.name}
        onDownload={recorder.downloadRecording}
      />

      {/* Developer & Workspace Analytics Modal */}
      <AnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        workspaceId={room?.project?.workspaceId || room?.id}
      />
    </div>
  );
};
