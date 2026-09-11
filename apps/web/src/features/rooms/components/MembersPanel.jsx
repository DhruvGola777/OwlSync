import React from 'react';
import { Mic, MicOff, VolumeX, PhoneOff, Shield, Users, Radio, X, PhoneCall, Volume2, UserCheck, Eye, UserMinus } from 'lucide-react';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';
import { socketService } from '../../../services/socket';

export const MembersPanel = ({
  roomId,
  activeUsers = [],
  currentUser,
  roomOwnerId,
  roomMembers = [],
  voice,
  onClose
}) => {
  const isHost = roomOwnerId === currentUser?.id;
  const inVoice = voice?.inVoice || false;
  const voiceUsers = voice?.voiceUsers || [];
  const mutedPeerSocketIds = voice?.mutedPeerSocketIds || new Set();
  const socket = socketService.getSocket();

  // Helper to resolve real user profile data (name, username, avatar, role)
  const resolveUser = (u) => {
    const uId = typeof u === 'string' ? u : (u?.id || u?.userId);
    const member = roomMembers?.find(m => m.user?.id === uId || m.userId === uId || m.id === uId);
    const isOwner = uId === roomOwnerId || member?.role === 'OWNER';
    const role = isOwner ? 'OWNER' : (member?.role || 'MEMBER');

    if (currentUser?.id && uId === currentUser.id) {
      return {
        id: currentUser.id,
        name: currentUser.name || currentUser.username || 'You',
        username: currentUser.username || '',
        avatarUrl: currentUser.avatarUrl,
        isCurrent: true,
        isHost: isOwner,
        role
      };
    }

    if (member?.user) {
      return {
        id: member.user.id,
        name: member.user.name || member.user.username || 'Collaborator',
        username: member.user.username || '',
        avatarUrl: member.user.avatarUrl,
        isCurrent: member.user.id === currentUser?.id,
        isHost: isOwner,
        role
      };
    }

    if (typeof u === 'object' && (u?.name || u?.username)) {
      return {
        id: uId,
        name: u.name || u.username,
        username: u.username || '',
        avatarUrl: u.avatarUrl,
        isCurrent: uId === currentUser?.id,
        isHost: isOwner,
        role
      };
    }

    return {
      id: uId,
      name: (currentUser?.id && uId === currentUser.id) ? (currentUser.name || 'You') : 'Collaborator',
      username: '',
      avatarUrl: null,
      isCurrent: uId === currentUser?.id,
      isHost: isOwner,
      role
    };
  };

  // Set of active/online user IDs
  const activeUserIds = new Set(
    activeUsers.map(u => (typeof u === 'string' ? u : (u?.id || u?.userId))).filter(Boolean)
  );
  if (currentUser?.id) activeUserIds.add(currentUser.id);

  // Separate members into In Voice vs. Other Members
  const inVoiceUserIds = new Set(voiceUsers.map(v => v.userId));
  if (inVoice && currentUser?.id) {
    inVoiceUserIds.add(currentUser.id);
  }

  // Build list of other room members not currently on voice stage
  const otherMembersList = [];
  const seenIds = new Set();

  if (roomMembers && roomMembers.length > 0) {
    roomMembers.forEach(m => {
      const mId = m.user?.id || m.userId;
      if (mId && !inVoiceUserIds.has(mId) && !seenIds.has(mId)) {
        seenIds.add(mId);
        otherMembersList.push(resolveUser(mId));
      }
    });
  }

  activeUsers.forEach(u => {
    const uId = typeof u === 'string' ? u : (u?.id || u?.userId);
    if (uId && !inVoiceUserIds.has(uId) && !seenIds.has(uId)) {
      seenIds.add(uId);
      otherMembersList.push(resolveUser(u));
    }
  });

  const totalInVoice = voiceUsers.length + (inVoice ? 1 : 0);

  return (
    <div className="flex flex-col h-full bg-[#1e1e24] w-full overflow-hidden select-none">
      <style>{`
        @keyframes meetRipple {
          0% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.4); opacity: 0.35; }
          100% { transform: scale(1.75); opacity: 0; }
        }
        .speaking-ripple {
          animation: meetRipple 1.4s cubic-bezier(0, 0.2, 0.8, 1) infinite;
        }
        .speaking-ripple-delayed {
          animation: meetRipple 1.4s cubic-bezier(0, 0.2, 0.8, 1) infinite;
          animation-delay: 0.6s;
        }
      `}</style>

      {/* Panel Top Header */}
      <div className="px-4 py-3 bg-[#18181c] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Members & Voice</span>
            </h3>
            <p className="text-[10px] text-gray-400">{activeUserIds.size} online collaborators</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {totalInVoice > 0 && (
            <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {totalInVoice} in Voice
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {/* If user is NOT in voice channel: Show Quick Join Tile */}
        {!inVoice && (
          <div className="p-3 bg-[#23232a] border border-white/10 rounded-2xl shadow-sm text-center">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-2 border border-indigo-500/30">
              <Radio className="w-5 h-5 text-indigo-300 animate-pulse" />
            </div>
            <h4 className="text-xs font-bold text-white mb-0.5">Voice Channel</h4>
            <p className="text-[11px] text-gray-400 mb-3">
              {totalInVoice > 0 ? `${totalInVoice} member${totalInVoice > 1 ? 's are' : ' is'} talking now` : 'Talk and code live with your team'}
            </p>
            <button
              onClick={voice.joinVoice}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95 border border-indigo-400/30 group"
            >
              <Mic className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
              <span>Join Voice Channel</span>
            </button>
          </div>
        )}

        {/* GOOGLE MEET STYLE PARTICIPANT TILES */}
        {(inVoice || voiceUsers.length > 0) && (
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 px-1">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Voice Stage ({totalInVoice})</span>
            </div>

            {/* Current User Google Meet Rectangle Box */}
            {inVoice && (
              <div className="bg-gradient-to-b from-[#26262e] to-[#1a1a20] border border-white/15 rounded-2xl shadow-xl overflow-hidden relative aspect-[16/10] sm:aspect-[16/10] flex flex-col justify-between p-3.5 transition-all">
                {/* Top Overlay: Status indicator */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center space-x-1.5">
                    {voice.isSpeaking && !voice.isMuted ? (
                      <span className="inline-flex items-center text-[10px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded-full shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
                        Speaking
                      </span>
                    ) : voice.isMuted ? (
                      <span className="inline-flex items-center text-[10px] font-semibold text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-full shadow-sm">
                        <MicOff className="w-2.5 h-2.5 mr-1 text-rose-400" />
                        Muted
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-semibold text-gray-300 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                        <Volume2 className="w-2.5 h-2.5 mr-1 text-indigo-300" />
                        Ready
                      </span>
                    )}
                  </div>

                  {isHost && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-mono border border-amber-500/30 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                </div>

                {/* Center: Avatar with Google Meet Sound Ripple Ring Animation */}
                <div className="flex-1 flex items-center justify-center relative py-1">
                  {voice.isSpeaking && !voice.isMuted && (
                    <>
                      <div className="absolute w-20 h-20 rounded-full bg-emerald-500/30 speaking-ripple pointer-events-none" />
                      <div className="absolute w-20 h-20 rounded-full bg-emerald-500/20 speaking-ripple-delayed pointer-events-none" />
                    </>
                  )}
                  <div className={`relative rounded-full p-1 transition-all duration-200 z-10 ${
                    voice.isSpeaking && !voice.isMuted
                      ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-[#1a1a20] shadow-[0_0_25px_rgba(52,211,153,0.6)] scale-105'
                      : 'ring-2 ring-white/15'
                  }`}>
                    <AvatarDisplay 
                      avatarUrl={currentUser?.avatarUrl} 
                      name={currentUser?.name || currentUser?.username} 
                      size={52} 
                    />
                    {voice.isMuted && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-rose-600 rounded-full p-1 text-white ring-2 ring-[#1a1a20] shadow-md">
                        <MicOff className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Overlay: User Name + Consolidated Controls Bar (Mute & Hangup) in the same box */}
                <div className="flex items-center justify-between z-10 pt-1">
                  {/* Name Tag */}
                  <div className="flex items-center space-x-1.5 min-w-0 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 max-w-[130px]">
                    <span className="text-xs font-semibold text-white truncate">
                      {currentUser?.name || currentUser?.username || 'You'}
                    </span>
                    <span className="text-[9px] text-indigo-300 font-mono shrink-0">(You)</span>
                  </div>

                  {/* Same Box Google Meet Action Controls (Mute + Hangup) */}
                  <div className="flex items-center space-x-1.5 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/15 shadow-md">
                    {/* Mute Button */}
                    <button
                      onClick={voice.toggleMute}
                      className={`p-2 rounded-lg transition-all active:scale-95 ${
                        voice.isMuted 
                          ? 'bg-rose-500/30 text-rose-300 hover:bg-rose-500/40 border border-rose-500/40' 
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                      }`}
                      title={voice.isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                      {voice.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    {/* Hang Up Button */}
                    <button
                      onClick={voice.leaveVoice}
                      className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95 shadow-md shadow-rose-900/40 border border-rose-400/40"
                      title="Leave Voice Channel (Hang Up)"
                    >
                      <PhoneOff className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Other Voice Peers (Google Meet Rectangle Boxes) */}
            {voiceUsers.map((u) => {
              const peerInfo = resolveUser(u.user || u.userId);
              const isPeerMutedLocally = mutedPeerSocketIds.has(u.socketId);
              const isUserHost = u.userId === roomOwnerId;
              const isPeerSpeaking = !!u.isSpeaking && !u.isMuted;

              return (
                <div key={u.socketId} className="bg-gradient-to-b from-[#26262e] to-[#1a1a20] border border-white/15 rounded-2xl shadow-xl overflow-hidden relative aspect-[16/10] sm:aspect-[16/10] flex flex-col justify-between p-3.5 transition-all">
                  {/* Top Overlay */}
                  <div className="flex items-center justify-between z-10">
                    <div className="flex items-center space-x-1.5">
                      {isPeerSpeaking ? (
                        <span className="inline-flex items-center text-[10px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded-full shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
                          Speaking
                        </span>
                      ) : u.isMuted ? (
                        <span className="inline-flex items-center text-[10px] font-semibold text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-full shadow-sm">
                          <MicOff className="w-2.5 h-2.5 mr-1 text-rose-400" />
                          Muted
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-semibold text-gray-300 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                          <Volume2 className="w-2.5 h-2.5 mr-1 text-indigo-300" />
                          Listening
                        </span>
                      )}
                    </div>

                    {isUserHost && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-mono border border-amber-500/30 flex items-center gap-1">
                        <Shield className="w-2.5 h-2.5" /> Host
                      </span>
                    )}
                  </div>

                  {/* Center: Avatar with Sound Ripple Rings */}
                  <div className="flex-1 flex items-center justify-center relative py-1">
                    {isPeerSpeaking && (
                      <>
                        <div className="absolute w-20 h-20 rounded-full bg-emerald-500/30 speaking-ripple pointer-events-none" />
                        <div className="absolute w-20 h-20 rounded-full bg-emerald-500/20 speaking-ripple-delayed pointer-events-none" />
                      </>
                    )}
                    <div className={`relative rounded-full p-1 transition-all duration-200 z-10 ${
                      isPeerSpeaking
                        ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-[#1a1a20] shadow-[0_0_25px_rgba(52,211,153,0.6)] scale-105'
                        : 'ring-2 ring-white/15'
                    }`}>
                      <AvatarDisplay 
                        avatarUrl={peerInfo.avatarUrl || u.user?.avatarUrl} 
                        name={peerInfo.name} 
                        size={52} 
                      />
                      {u.isMuted && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-rose-600 rounded-full p-1 text-white ring-2 ring-[#1a1a20] shadow-md">
                          <MicOff className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Overlay: Peer Name + Local Mute Controls in the same box */}
                  <div className="flex items-center justify-between z-10 pt-1">
                    <div className="flex items-center space-x-1 min-w-0 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 max-w-[140px]">
                      <span className="text-xs font-semibold text-white truncate">
                        {peerInfo.name}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/15 shadow-md">
                      {/* Local Peer Mute Button */}
                      <button
                        onClick={() => voice.toggleMutePeer(u.socketId)}
                        className={`p-2 rounded-lg transition-all active:scale-95 ${
                          isPeerMutedLocally 
                            ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40' 
                            : 'bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10'
                        }`}
                        title={isPeerMutedLocally ? "Unmute user for you" : "Mute user for you"}
                      >
                        {isPeerMutedLocally ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                      </button>

                      {/* Host Remote Mute if current user is owner */}
                      {isHost && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Mute ${peerInfo.name} for everyone in room?`)) {
                              voice.hostMuteUser(u.socketId, u.userId);
                            }
                          }}
                          className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all active:scale-95"
                          title="Host Mute for everyone"
                        >
                          <MicOff className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SECTION: OTHER ROOM MEMBERS (NOT IN VOICE) */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 px-1">
            Other Room Members ({otherMembersList.length})
          </div>

          <div className="space-y-1.5">
            {otherMembersList.length === 0 ? (
              <div className="text-[11px] text-gray-500 text-center py-3 bg-white/5 rounded-xl border border-white/5">
                All online collaborators are on the voice stage.
              </div>
            ) : (
              otherMembersList.map((m) => {
                const isOnline = activeUserIds.has(m.id);

                const isViewer = m.role === 'GUEST';

                const handleToggleRole = () => {
                  if (!socket || !roomId) return;
                  const newRole = isViewer ? 'MEMBER' : 'GUEST';
                  socket.emit('room:change_role', {
                    roomId,
                    targetUserId: m.id,
                    newRole
                  });
                };

                const handleKick = () => {
                  if (!socket || !roomId) return;
                  if (window.confirm(`Kick ${m.name} from this room?`)) {
                    socket.emit('room:kick_user', {
                      roomId,
                      targetUserId: m.id
                    });
                  }
                };

                return (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <AvatarDisplay avatarUrl={m.avatarUrl} name={m.name} size={28} />
                        <div className={`w-2 h-2 rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-[#1e1e24] ${
                          isOnline ? 'bg-emerald-500' : 'bg-gray-500'
                        }`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-200 font-medium truncate">{m.name}</span>
                          {m.isCurrent && <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 py-0.2 rounded font-mono">You</span>}
                          {m.isHost ? (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono border border-amber-500/30 flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5" /> Host
                            </span>
                          ) : isViewer ? (
                            <span className="text-[9px] bg-slate-500/20 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-500/30 flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5" /> Viewer
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-500/30 flex items-center gap-0.5">
                              <UserCheck className="w-2.5 h-2.5" /> Editor
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {isOnline ? (
                            <span className="text-emerald-400">Online</span>
                          ) : (
                            <span className="text-gray-500">Offline</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Host action controls */}
                    {isHost && !m.isCurrent ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={handleToggleRole}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition flex items-center gap-1 border ${
                            isViewer
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/40'
                          }`}
                          title={isViewer ? "Grant Editor Access" : "Set to Read-Only Viewer"}
                        >
                          {isViewer ? <UserCheck size={11} /> : <Eye size={11} />}
                          <span>{isViewer ? 'Make Editor' : 'Make Viewer'}</span>
                        </button>
                        <button
                          onClick={handleKick}
                          className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Kick user"
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    ) : isOnline ? (
                      <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded font-mono border border-white/10 shrink-0">
                        In Room
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
