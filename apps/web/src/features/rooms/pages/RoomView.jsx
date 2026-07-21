import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { useAuth } from '../../../providers/AuthProvider';
import { Users, Settings, MessageSquare, Code, Loader2, X, LogOut, UserMinus } from 'lucide-react';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';

export const RoomView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const handleLeaveRoom = async () => {
    if (window.confirm("Are you sure you want to leave this room?")) {
      try {
        await api.leaveRoom(room.id);
        navigate('/');
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleDeleteRoom = async () => {
    if (window.confirm("Are you sure you want to permanently delete this room? This action cannot be undone.")) {
      try {
        await api.deleteRoom(room.id);
        navigate('/');
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleKickMember = async (targetUserId) => {
    if (window.confirm("Are you sure you want to kick this user?")) {
      try {
        await api.kickMember(room.id, targetUserId);
        
        // Notify socket server to force disconnect the user
        const socket = socketService.getSocket();
        if (socket) {
          socket.emit('room:kick_user', { roomId: room.id, targetUserId });
        }

        // Optimistically update the UI
        setRoom(prev => ({
          ...prev,
          members: prev.members.filter(m => m.user.id !== targetUserId)
        }));
      } catch (err) {
        alert(err.message);
      }
    }
  };

  useEffect(() => {
    let socket;
    
    const fetchRoomAndConnect = async () => {
      try {
        const res = await api.getRoom(id);
        let fetchedRoom = res.room;
        
        // Check if the current user is a member
        const isMember = fetchedRoom.members.some(m => m.user.id === user?.id);

        if (!isMember) {
          if (fetchedRoom.isProtected) {
            // User is not a member and room is protected. Redirect back.
            alert("This room is password protected. Please join from the dashboard.");
            navigate('/');
            return;
          } else {
            // Auto-join public room
            try {
              await api.joinRoom(id, '');
              // Refetch room to get updated members list
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
        socket.on('room:user_joined', async ({ userId }) => {
          setActiveUsers(prev => [...new Set([...prev, userId])]);
          // Re-fetch room data to get the new member's info if they just joined
          try {
            const updatedRes = await api.getRoom(id);
            setRoom(updatedRes.room);
          } catch (e) {
            console.error('Error refetching room on user join', e);
          }
        });

        socket.on('room:user_left', ({ userId }) => {
          setActiveUsers(prev => prev.filter(uid => uid !== userId));
        });

        socket.on('room:kicked', () => {
          alert('You have been kicked from the room.');
          navigate('/');
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
        socket.off('room:kicked');
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
            {room.ownerId === user?.id && (
              <button 
                onClick={handleDeleteRoom}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30"
                title="Delete Room"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Delete Room
              </button>
            )}
            {room.ownerId !== user?.id && (
              <button 
                onClick={handleLeaveRoom}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30"
                title="Leave Room"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Leave
              </button>
            )}
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
                  <div key={member.id} className="flex items-center space-x-3 p-2 rounded-lg bg-white/5 group relative">
                    <div className="relative shrink-0">
                      <AvatarDisplay 
                        avatarUrl={member.user.avatarUrl} 
                        name={member.user.name || member.user.username} 
                        size={32} 
                      />
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200 truncate">
                        {member.user.name || member.user.username}
                        {member.user.id === user?.id && <span className="ml-1 text-xs text-gray-500">(You)</span>}
                      </div>
                      <div className="text-xs text-gray-400">{member.role}</div>
                    </div>
                    {room.ownerId === user?.id && member.user.id !== user?.id && (
                      <button
                        onClick={() => handleKickMember(member.user.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all shrink-0"
                        title="Kick from room"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
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
