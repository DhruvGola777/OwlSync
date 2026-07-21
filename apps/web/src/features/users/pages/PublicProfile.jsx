import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Check, Clock, ShieldCheck, MapPin, Link as LinkIcon, Loader2, Ban, UserX } from 'lucide-react';
import { api } from '../../../services/api';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';
import { formatDistanceToNow } from 'date-fns';

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await api.getPublicProfile(username);
      setProfile(data);
      setError('');
    } catch (err) {
      setError(err.message || 'User not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const handleAction = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      if (profile.relationship === 'NONE') {
        await api.sendFriendRequest(profile.username);
        setProfile(prev => ({ ...prev, relationship: 'PENDING_OUTGOING' }));
      } else if (profile.relationship === 'PENDING_INCOMING') {
        await api.acceptFriendRequest(profile.requestId);
        setProfile(prev => ({ ...prev, relationship: 'FRIENDS' }));
      } else if (profile.relationship === 'FRIENDS') {
        // Mock remove friend for now
        alert('Unfriend feature coming soon!');
      }
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!profile) return;
    if (window.confirm('Are you sure you want to block this user? They will be removed from your friends list.')) {
      try {
        setActionLoading(true);
        await api.blockUser(profile.id);
        setProfile(prev => ({ ...prev, relationship: 'BLOCKED' }));
      } catch (err) {
        alert(err.message || 'Block failed');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleUnblock = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      await api.unblockUser(profile.id);
      setProfile(prev => ({ ...prev, relationship: 'NONE' }));
    } catch (err) {
      alert(err.message || 'Unblock failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center mb-6">
          <ShieldCheck className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">User Not Found</h2>
        <p className="text-slate-500 mb-8 max-w-md">The user you are looking for doesn't exist or may have changed their username.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header Card */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600 sm:h-48" />
        
        <div className="px-6 pb-8">
          <div className="relative flex justify-between sm:px-4">
            <div className="-mt-16 sm:-mt-24">
              <div className="relative inline-block rounded-full ring-4 ring-white">
                <AvatarDisplay avatarUrl={profile.avatarUrl} name={profile.name || profile.username} size={128} />
                {profile.status === 'ONLINE' && (
                  <span className="absolute bottom-2 right-2 block h-6 w-6 rounded-full bg-green-500 ring-4 ring-white" />
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              {profile.relationship !== 'SELF' && (
                <>
                  {profile.relationship === 'BLOCKED' ? (
                    <button
                      onClick={handleUnblock}
                      disabled={actionLoading}
                      className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all bg-red-100 text-red-600 hover:bg-red-200"
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserX className="h-4 w-4" /> Unblock</>}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleAction}
                        disabled={actionLoading || profile.relationship === 'PENDING_OUTGOING'}
                        className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all ${
                          profile.relationship === 'NONE'
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                            : profile.relationship === 'PENDING_INCOMING'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : profile.relationship === 'PENDING_OUTGOING'
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200' // Friends
                        }`}
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : profile.relationship === 'NONE' ? (
                          <><UserPlus className="h-4 w-4" /> Add Friend</>
                        ) : profile.relationship === 'PENDING_INCOMING' ? (
                          <><Check className="h-4 w-4" /> Accept Request</>
                        ) : profile.relationship === 'PENDING_OUTGOING' ? (
                          <><Clock className="h-4 w-4" /> Request Sent</>
                        ) : (
                          <><Check className="h-4 w-4" /> Friends</>
                        )}
                      </button>
                      <button
                        onClick={handleBlock}
                        disabled={actionLoading}
                        className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-sm transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-red-600"
                        title="Block User"
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-6 sm:px-4">
            <h1 className="text-2xl font-bold text-slate-900">{profile.name || profile.username}</h1>
            <p className="text-sm font-medium text-slate-500">@{profile.username}</p>

            <div className="mt-4 max-w-2xl text-base text-slate-700">
              {profile.bio || "This user hasn't written a bio yet, but they seem pretty cool! ✨"}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>Internet Explorer</span>
              </div>
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-slate-400" />
                <a href="#" className="text-indigo-600 hover:underline">owlsync.com/@{profile.username}</a>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>Last seen {profile.status === 'ONLINE' ? 'now' : formatDistanceToNow(new Date(profile.lastSeen), { addSuffix: true })}</span>
              </div>
            </div>

            {profile.mutualFriends && profile.relationship !== 'SELF' && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Mutual Friends ({profile.mutualFriends.length})</h3>
                {profile.mutualFriends.length > 0 ? (
                  <div className="flex flex-wrap gap-6">
                    {profile.mutualFriends.map(mf => (
                      <div 
                        key={mf.id} 
                        className="flex flex-col items-center gap-2 cursor-pointer group" 
                        onClick={() => {
                          navigate(`/profile/${mf.username}`);
                        }}
                      >
                        <div className="ring-2 ring-transparent group-hover:ring-indigo-100 rounded-full transition-all">
                          <AvatarDisplay avatarUrl={mf.avatarUrl} name={mf.name || mf.username} size={48} />
                        </div>
                        <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 transition-colors max-w-[64px] text-center truncate">
                          {mf.name || mf.username}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No mutual friends yet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Demo Stats Section */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50">
          <div className="p-6 text-center">
            <div className="text-2xl font-bold tracking-tight text-slate-900">42</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">Rooms Created</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-2xl font-bold tracking-tight text-slate-900">128</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">Friends</div>
          </div>
          <div className="p-6 text-center">
            <div className="text-2xl font-bold tracking-tight text-slate-900">8.4k</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">Messages</div>
          </div>
        </div>
      </div>

      {/* Demo Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {[1, 2, 3].map((i) => (
              <li key={i} className="flex gap-4 p-4 sm:p-6">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <Check className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-900">
                    Created a new room <span className="font-semibold">Project Kickoff {i}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{i * 2} hours ago</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
