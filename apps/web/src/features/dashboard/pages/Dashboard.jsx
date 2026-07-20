import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import { Code2, Plus, Loader2, KeyRound } from 'lucide-react';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinRoomPassword, setJoinRoomPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await api.getRooms();
      setRooms(res.data.rooms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    
    setIsSubmitting(true);
    setError('');
    try {
      const res = await api.createRoom({ 
        name: newRoomName,
        description: '',
        password: newRoomPassword || undefined 
      });
      setRooms([res.data.room, ...rooms]);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomPassword('');
      navigate(`/room/${res.data.room.id}`);
    } catch (err) {
      console.error("CREATE ROOM ERROR:", err);
      setError(err.message + " | " + JSON.stringify(err) + " | " + (err.response ? JSON.stringify(err.response.data) : "No response"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      const res = await api.joinRoom(joinRoomId, joinRoomPassword || undefined);
      navigate(`/room/${res.data.room.id}`);
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Your Rooms</h1>
          <p className="text-slate-600 mt-1">Jump back into your collaborative sessions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium shadow-sm"
          >
            <KeyRound size={18} />
            Join Room
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm shadow-indigo-200"
          >
            <Plus size={18} />
            Create Room
          </button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Code2 size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No rooms yet</h2>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Create a new room to start coding, or join an existing room with an ID and password.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowJoinModal(true)}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition"
            >
              Join Room
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition shadow-md shadow-indigo-200"
            >
              Create Room
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <div 
              key={room.id}
              onClick={() => navigate(`/room/${room.id}`)}
              className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:border-indigo-300 transition cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Code2 size={20} />
                </div>
                {room.password && (
                  <div className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-md flex items-center gap-1">
                    <KeyRound size={12} /> Protected
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{room.name}</h3>
              <p className="text-slate-500 text-sm mb-4 line-clamp-2 min-h-10">
                {room.description || 'No description provided.'}
              </p>
              
              <div className="flex items-center justify-between text-sm pt-4 border-t border-slate-100">
                <span className="text-slate-500">ID: <span className="font-mono text-slate-700">{room.id.split('-')[0]}</span></span>
                <span className="font-medium text-indigo-600 group-hover:underline">Enter Room &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Create Room</h2>
            <p className="text-slate-500 mb-6 text-sm">Start a new collaborative coding session.</p>
            
            {error && <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
            
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room Name *</label>
                <input
                  autoFocus
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition"
                  placeholder="e.g. Python Hackathon"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room Password (Optional)</label>
                <input
                  type="password"
                  value={newRoomPassword}
                  onChange={(e) => setNewRoomPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition"
                  placeholder="Leave empty for public access"
                />
                <p className="text-xs text-slate-500 mt-1.5">If set, users will need this password to join.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setError(''); }}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newRoomName.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Join Room</h2>
            <p className="text-slate-500 mb-6 text-sm">Enter a Room ID to join an existing session.</p>
            
            {error && <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
            
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Room ID *</label>
                <input
                  autoFocus
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition"
                  placeholder="xxxxxxxx-xxxx-xxxx..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={joinRoomPassword}
                  onChange={(e) => setJoinRoomPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none transition"
                  placeholder="Required if room is protected"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowJoinModal(false); setError(''); }}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !joinRoomId.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
