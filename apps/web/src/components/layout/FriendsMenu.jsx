import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Check, X, Search, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import AvatarDisplay from '../ui/AvatarDisplay';
import { formatDistanceToNow } from 'date-fns';

export const FriendsMenu = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [incomingReqs, setIncomingReqs] = useState([]);
  const [outgoingReqs, setOutgoingReqs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [searchUsername, setSearchUsername] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchUsername.trim()) {
        try {
          const res = await api.searchUsers(searchUsername);
          setSuggestions(res.users || []);
          setShowSuggestions(true);
        } catch (err) {
          console.error(err);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchUsername]);

  const handleSuggestionClick = (username) => {
    setSearchUsername('');
    setShowSuggestions(false);
    setIsOpen(false);
    navigate(`/profile/${username}`);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [friendsData, requestsData] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests()
      ]);
      setFriends(friendsData.friends || []);
      setIncomingReqs(requestsData.incoming || []);
      setOutgoingReqs(requestsData.outgoing || []);
    } catch (err) {
      console.error('Failed to load friends data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) fetchData(); // refresh on open
  };

  const handleSendRequest = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchUsername.trim()) return;
    
    // Instead of sending the request directly, navigate to the profile
    const targetUsername = searchUsername.trim();
    setSearchUsername('');
    setShowSuggestions(false);
    setIsOpen(false);
    navigate(`/profile/${targetUsername}`);
  };

  const handleAccept = async (reqId) => {
    try {
      await api.acceptFriendRequest(reqId);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDecline = async (reqId) => {
    try {
      await api.declineFriendRequest(reqId);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const hasNotifications = incomingReqs.length > 0;

  return (
    <div className="relative">
      <button 
        type="button" 
        onClick={handleOpen}
        className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-500 transition-colors relative"
      >
        <span className="sr-only">View friends</span>
        <Users className="h-6 w-6" aria-hidden="true" />
        {hasNotifications && (
          <span className="absolute top-2 right-2 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Friend</h3>
              <form onSubmit={handleSendRequest} className="relative flex gap-2">
                <div className="relative flex-1">
                  <UserPlus className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter username..."
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                  {searchUsername && (
                    <button
                      type="button"
                      onClick={() => setSearchUsername('')}
                      className="absolute right-2 top-2 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                      {suggestions.map((sug) => (
                        <div 
                          key={sug.username}
                          onMouseDown={() => handleSuggestionClick(sug.username)}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <AvatarDisplay avatarUrl={sug.avatarUrl} name={sug.name || sug.username} size={32} />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{sug.name || sug.username}</span>
                            <span className="text-xs text-gray-500">@{sug.username}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
              {searchMessage && (
                <p className={`mt-2 text-xs ${searchMessage.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>
                  {searchMessage}
                </p>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto p-4 space-y-6">
              {loading && !friends.length && !incomingReqs.length && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              )}

              {/* Pending Requests */}
              {incomingReqs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    Pending Requests ({incomingReqs.length})
                  </h3>
                  <div className="space-y-3">
                    {incomingReqs.map(req => (
                      <div key={req.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AvatarDisplay avatarUrl={req.sender.avatarUrl} name={req.sender.name || req.sender.username} size={32} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{req.sender.name || req.sender.username}</p>
                            <p className="text-xs text-gray-500">@{req.sender.username}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleAccept(req.id)} className="p-1.5 bg-green-100 text-green-600 rounded-full hover:bg-green-200">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDecline(req.id)} className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friends List */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Friends ({friends.length})
                </h3>
                {friends.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">No friends yet.</p>
                ) : (
                  <div className="space-y-3">
                    {friends.map(friend => (
                      <div 
                        key={friend.id} 
                        className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition-colors -mx-2"
                        onClick={() => {
                          setIsOpen(false);
                          navigate(`/profile/${friend.username}`);
                        }}
                      >
                        <div className="relative">
                          <AvatarDisplay avatarUrl={friend.avatarUrl} name={friend.name || friend.username} size={32} />
                          {friend.status === 'ONLINE' && (
                            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{friend.name || friend.username}</p>
                          <p className="text-xs text-gray-500">
                            {friend.status === 'ONLINE' ? 'Online' : (friend.lastSeen ? `Last seen ${formatDistanceToNow(new Date(friend.lastSeen), { addSuffix: true })}` : 'Offline')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
