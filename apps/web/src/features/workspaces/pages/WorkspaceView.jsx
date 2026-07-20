import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { useAuth } from '../../../providers/AuthProvider';
import { Users, Settings, MessageSquare, Code, Loader2, X } from 'lucide-react';

export const WorkspaceView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  useEffect(() => {
    let socket;
    
    const initWorkspace = async () => {
      try {
        // Fetch workspace details
        const res = await api.getWorkspace(id);
        setWorkspace(res.data.workspace);

        // Connect to Socket.IO
        socket = socketService.connect(token);
        
        if (socket.connected) {
          socketService.joinWorkspace(id);
        } else {
          socket.on('connect', () => {
            socketService.joinWorkspace(id);
          });
        }

        // Listen for the initial list of active users
        socket.on('workspace:active_users', ({ activeUsers }) => {
          setActiveUsers(activeUsers);
        });

        // Listen for presence events
        socket.on('workspace:user_joined', ({ userId }) => {
          setActiveUsers(prev => [...new Set([...prev, userId])]);
        });

        socket.on('workspace:user_left', ({ userId }) => {
          setActiveUsers(prev => prev.filter(u => u !== userId));
        });

      } catch (err) {
        console.error('Failed to load workspace', err);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    initWorkspace();

    return () => {
      if (socket) {
        socketService.leaveWorkspace(id);
        socket.off('workspace:active_users');
        socket.off('workspace:user_joined');
        socket.off('workspace:user_left');
      }
    };
  }, [id, token, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="flex h-screen bg-slate-50 flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-800">{workspace.name}</h1>
          <button 
            onClick={() => setIsMembersOpen(!isMembersOpen)}
            className="flex items-center gap-2 text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-full font-medium transition"
          >
            <Users size={16} />
            {workspace.members.length} Members ({activeUsers.length} Online)
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Sidebar / Tools */}
        <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4 shrink-0 z-10">
          <button className="p-3 bg-indigo-50 text-indigo-600 rounded-xl relative group">
            <Code size={24} />
            <span className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
              Code Editor
            </span>
          </button>
          <button className="p-3 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition relative group">
            <MessageSquare size={24} />
            <span className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
              Chat
            </span>
          </button>
        </aside>

        {/* Workspace Canvas (Placeholder for Editor/Chat) */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Code className="text-indigo-600" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Workspace Initialized</h2>
              <p className="text-slate-600 text-lg mb-8 max-w-lg mx-auto">
                You are successfully connected to the real-time Socket.IO server. 
                In Phase 3, the collaborative code editor and chat features will be integrated here.
              </p>
            </div>
          </div>
        </main>

        {/* Right Sidebar for Members */}
        {isMembersOpen && (
          <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-xl absolute right-0 top-0 bottom-0 z-20 animate-in slide-in-from-right">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Workspace Members</h3>
              <button 
                onClick={() => setIsMembersOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-4">
                {workspace.members.map((member) => {
                  const isOnline = activeUsers.includes(member.user.id);
                  const isMe = member.user.id === user.id;

                  return (
                    <div key={member.user.id} className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                          {member.user.name?.charAt(0) || member.user.username.charAt(0)}
                        </div>
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {member.user.name || member.user.username}
                            {isMe && <span className="ml-2 text-xs font-normal text-slate-500">(You)</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 capitalize">{member.role.toLowerCase()}</span>
                          <span className="text-slate-300">•</span>
                          <span className={isOnline ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

      </div>
    </div>
  );
};

