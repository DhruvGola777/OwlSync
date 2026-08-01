import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { useAuth } from '../../../providers/AuthProvider';
import { 
  VscFiles, VscSearch, VscSourceControl, VscTerminal, VscAccount, VscSettingsGear, VscBroadcast,
  VscCheckAll, VscBell, VscFeedback, VscError, VscWarning, VscCommentDiscussion, VscOrganization, VscSignOut, VscTrash, VscNotebook, VscEdit, VscHistory, VscPlay
} from 'react-icons/vsc';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';
import { ChatPanel } from '../components/ChatPanel';
import { NotesPanel } from '../components/NotesPanel';
import { WhiteboardPanel } from '../components/WhiteboardPanel';
import { TimelinePanel } from '../components/TimelinePanel';
import { CodeEditor } from '../components/CodeEditor';
import { FileExplorer } from '../components/FileExplorer';
import { SearchPanel } from '../components/SearchPanel';
import { EditorTabs } from '../components/EditorTabs';

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
  
  // VS Code Layout State
  const [activityBarTab, setActivityBarTab] = useState('explorer'); // 'explorer', 'search'
  const [rightPanel, setRightPanel] = useState('none'); // 'chat', 'members', 'timeline', 'none'
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('owlsync_sidebar_width');
    return saved ? parseInt(saved, 10) : 256;
  });

  useEffect(() => {
    localStorage.setItem('owlsync_sidebar_width', sidebarWidth);
  }, [sidebarWidth]);

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

      if (!isProjectMode) {
        socketService.notifyFilesChanged(room.id);
      }
    } catch (err) {
      alert(err.message);
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
        socket = socketService.connect(token);
        
        if (socket.connected) socketService.joinRoom(id);
        else socket.on('connect', () => socketService.joinRoom(id));

        socket.on('room:active_users', ({ activeUsers }) => setActiveUsers(activeUsers));
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
  }, [id, navigate, token, isProjectMode]);

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
      <div className="flex items-center justify-between h-[40px] pl-0 pr-4 bg-[#252526] shrink-0 border-b border-white/10 relative">
        <div className="flex items-center">
          <div className="w-[56px] flex justify-center items-center text-[18px]">
            🦉
          </div>
          <div className="flex items-center space-x-5 text-[15.5px] font-medium text-gray-300 ml-1">
            <div className="hover:text-white cursor-pointer transition-colors">File</div>
            <div className="hover:text-white cursor-pointer transition-colors">View</div>
            <div className="hover:text-white cursor-pointer transition-colors">Terminal</div>
          </div>
        </div>

        {/* Centered Title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
          <div className="text-[14px] font-bold text-white flex items-center tracking-wide">
            {room.name || 'OwlSync Project'}
            {!isProjectMode && (
              <span className="ml-3 flex items-center text-xs font-normal bg-white/10 px-2 py-0.5 rounded-full text-gray-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                {activeUsers.length} Online
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {!isProjectMode ? (
            <>
              <button 
                onClick={() => toggleRightPanel('notes')}
                className={`p-1.5 rounded transition-colors mr-2 ${rightPanel === 'notes' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Shared Notes"
              >
                <VscNotebook className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowWhiteboard(prev => !prev)}
                className={`p-1.5 rounded transition-colors mr-4 ${showWhiteboard ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Whiteboard"
              >
                <VscEdit className="w-5 h-5" />
              </button>

              <button 
                onClick={() => toggleRightPanel('chat')}
                className={`p-1.5 rounded transition-colors relative ${rightPanel === 'chat' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Room Chat"
              >
                <VscCommentDiscussion className="w-5 h-5" />
                {unreadCount > 0 && rightPanel !== 'chat' && (
                  <div className="absolute top-0 right-0 w-[12px] h-[12px] bg-indigo-500 rounded-full flex items-center justify-center text-[8px] text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </button>
              <button 
                onClick={() => toggleRightPanel('timeline')}
                className={`p-1.5 rounded transition-colors mr-2 ${rightPanel === 'timeline' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Session Timeline"
              >
                <VscHistory className="w-5 h-5" />
              </button>
              <button 
                onClick={() => toggleRightPanel('members')}
                className={`p-1.5 rounded transition-colors ${rightPanel === 'members' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Participants"
              >
                <VscOrganization className="w-5 h-5" />
              </button>
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
                className="flex items-center text-[13px] text-red-400 hover:text-white hover:bg-red-500 px-3 py-1 rounded transition-colors ml-2 border border-red-400/20 hover:border-red-500"
              >
                <VscSignOut className="w-4 h-4 mr-1.5" />
                {room?.ownerId === user?.id ? "End Session" : "Leave"}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => toggleRightPanel('notes')}
                className={`p-1.5 rounded transition-colors mr-2 ${rightPanel === 'notes' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Shared Notes"
              >
                <VscNotebook className="w-5 h-5" />
              </button>
              <button 
                onClick={() => toggleRightPanel('timeline')}
                className={`p-1.5 rounded transition-colors mr-2 ${rightPanel === 'timeline' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Project Timeline"
              >
                <VscHistory className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setShowWhiteboard(prev => !prev)}
                className={`p-1.5 rounded transition-colors mr-4 ${showWhiteboard ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Whiteboard"
              >
                <VscEdit className="w-5 h-5" />
              </button>
              <button 
                onClick={() => navigate('/projects')}
                className="flex items-center text-[13px] text-gray-300 hover:text-white hover:bg-white/10 px-3 py-1 rounded transition-colors border border-white/10"
              >
                <VscSignOut className="w-4 h-4 mr-1.5" />
                Close Project
              </button>
            </>
          )}
        </div>
      </div>

      {showWhiteboard ? (
        <div className="flex-1 flex w-full relative z-10 bg-[#252526]">
          <WhiteboardPanel projectId={isProjectMode ? id : room?.project?.id} isProjectMode={isProjectMode} />
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
            >
              {activityBarTab === 'search' && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500"></div>}
              <VscSearch className="w-7 h-7" />
            </button>
            <button 
              onClick={() => toggleActivityBarTab('terminal')}
              className={`p-2 relative transition-colors ${activityBarTab === 'terminal' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
              title="Terminal / Environments"
            >
              {activityBarTab === 'terminal' && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500"></div>}
              <VscTerminal className="w-7 h-7" />
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
                projectName={room.name}
                files={room.project.files}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
                onCreateFile={handleCreateFile}
                onRenameFile={handleRenameFile}
                onDeleteFile={handleDeleteFile}
              />
            )}

            {activityBarTab === 'search' && (
              <SearchPanel 
                files={room.project.files}
                onFileSelect={handleFileSelect}
              />
            )}

            {activityBarTab === 'terminal' && (
              <div className="flex flex-col h-full w-full p-6 items-center justify-center text-center">
                <VscTerminal className="w-12 h-12 text-gray-600 mb-4" />
                <h3 className="text-gray-300 font-medium text-[15px] mb-2">Execution Environment</h3>
                <p className="text-gray-500 text-[13px] leading-relaxed">
                  Terminal and code execution environments are coming in Phase 4.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#252526] relative">
          {openFiles.length > 0 ? (
            <>
              <EditorTabs 
                openFiles={openFiles} 
                activeFileId={activeFileId}
                onTabSelect={handleFileSelect}
                onTabClose={handleTabClose}
              />
              <div className="flex-1 min-h-0 relative w-full h-full">
                <CodeEditor 
                  key={activeFileId}
                  roomId={isProjectMode ? null : room.id} 
                  projectId={isProjectMode ? id : room.project.id}
                  activeFile={openFiles.find(f => f.id === activeFileId)}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 select-none bg-[#1e1e1e]">
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
        </div>

        {/* Right Sidebar Panels */}
        {!isProjectMode && rightPanel === 'members' && (
          <div className="flex flex-col h-full bg-[#252526] w-72 shrink-0 overflow-hidden border-l border-white/10">
            <div className="px-4 py-2 text-[13px] font-bold text-white tracking-wider uppercase h-[44px] flex items-center border-b border-white/10">
              Participants
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
              <div className="px-2 py-1 text-xs font-semibold text-gray-400 mb-2">ONLINE ({activeUsers.length})</div>
              {room.members.map((member) => {
                const isOnline = activeUsers.includes(member.user.id);
                if (!isOnline) return null;
                return (
                  <div key={member.id} className="flex items-center space-x-3 p-2 hover:bg-white/10 cursor-default rounded bg-white/5 mb-2">
                    <div className="relative">
                      <AvatarDisplay avatarUrl={member.user.avatarUrl} name={member.user.name || member.user.username} size={28} />
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#252526]"></div>
                    </div>
                    <div className="text-[14px] text-white truncate flex-1">
                      {member.user.name || member.user.username}
                      {member.user.id === user?.id ? (
                        <span className="ml-1 text-gray-400 text-xs font-normal">(You)</span>
                      ) : (
                        <span className="ml-1 text-gray-400 text-xs font-normal uppercase">{member.role}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isProjectMode && rightPanel === 'chat' && (
          <div className="flex flex-col h-full bg-[#252526] w-72 shrink-0 overflow-hidden border-l border-white/10">
            <div className="px-4 py-2 text-[13px] font-bold text-white tracking-wider uppercase h-[44px] flex items-center border-b border-white/10">
              Room Chat
            </div>
            <div className="flex-1 overflow-hidden relative">
               <ChatPanel roomId={room.id} onClose={() => {}} hideHeader={true} />
            </div>
          </div>
        )}

        <div 
          className={`flex flex-col h-full bg-[#252526] shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
            (rightPanel === 'notes' || rightPanel === 'timeline') ? 'w-80 border-l border-white/10 opacity-100' : 'w-0 border-none opacity-0'
          }`}
        >
          {(isProjectMode ? id : room?.project?.id) && rightPanel === 'notes' && (
            <NotesPanel projectId={isProjectMode ? id : room.project.id} isProjectMode={isProjectMode} />
          )}
          {(isProjectMode ? id : room?.project?.id) && rightPanel === 'timeline' && (
            <TimelinePanel projectId={isProjectMode ? id : room.project.id} isProjectMode={isProjectMode} />
          )}
        </div>
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
      
    </div>
  );
};
