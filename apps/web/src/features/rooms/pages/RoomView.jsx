import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { useAuth } from '../../../providers/AuthProvider';
import { Users, Settings, MessageSquare, Code, Loader2, X } from 'lucide-react';

export const RoomView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  useEffect(() => {
    let socket;
    
    const fetchRoomAndConnect = async () => {
      try {
        const res = await api.getRoom(id);
        setRoom(res.data.room);

        // Connect to socket and join room
        socket = socketService.connect(token);
        
        if (socket.connected) {
          socketService.joinRoom(id);
        } else {
          socket.on('connect', () => {
            socketService.joinRoom(id);
          });
        }

        // Listen for the initial list of active users
        socket.on('room:active_users', ({ activeUsers }) => {
          setActiveUsers(activeUsers);
        });

        // Listen for presence events
        socket.on('room:user_joined', ({ userId }) => {
          setActiveUsers(prev => [...new Set([...prev, userId])]);
        });

        socket.on('room:user_left', ({ userId }) => {
          setActiveUsers(prev => prev.filter(uid => uid !== userId));
        });

      } catch (err) {
        console.error('Failed to load room:', err);
        navigate('/'); // Redirect to dashboard if not found or no access
      } finally {
        setLoading(false);
      }
    };

    fetchRoomAndConnect();

    // Cleanup
    return () => {
      if (socket) {
        socketService.leaveRoom(id);
        socket.off('room:active_users');
        socket.off('room:user_joined');
        socket.off('room:user_left');
      }
    };
  }, [id, navigate, token]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!room) return null;

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-white/10 bg-gray-900/50 flex items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-white">{room.name}</h1>
            <div className="flex items-center space-x-2 bg-gray-800 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-300 font-medium">
                {activeUsers.length} Online
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsMembersOpen(!isMembersOpen)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Participants"
            >
              <Users className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Room Area Placeholder */}
        <div className="flex-1 p-6 flex flex-col">
          <div className="flex-1 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center bg-gray-900/20">
            <div className="text-center">
              <Code className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-white mb-2">Code Editor</h2>
              <p className="text-gray-400 max-w-sm">
                This is where the collaborative code editor and terminal will go.
                Socket connection to room <span className="text-indigo-400 font-mono">{room.id.split('-')[0]}</span> is active.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Participants */}
      <div className={`w-64 border-l border-white/10 bg-gray-900/50 flex flex-col transition-all duration-300 ${isMembersOpen ? 'mr-0' : '-mr-64'}`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Participants</h2>
          <button 
            onClick={() => setIsMembersOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Online</h3>
            <div className="space-y-2">
              {room.members.map((member) => {
                const isOnline = activeUsers.includes(member.user.id);
                if (!isOnline) return null;
                return (
                  <div key={member.id} className="flex items-center space-x-3 p-2 rounded-lg bg-white/5">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-medium text-sm">
                        {member.user.name?.[0] || member.user.username[0].toUpperCase()}
                      </div>
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-200">
                        {member.user.name || member.user.username}
                        {member.user.id === user?.id && <span className="ml-1 text-xs text-gray-500">(You)</span>}
                      </div>
                      <div className="text-xs text-gray-400">{member.role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
