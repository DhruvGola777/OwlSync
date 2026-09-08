import React from 'react';
import { Mic, MicOff, Headphones, VolumeX, PhoneCall, PhoneOff, Shield, User, Users, Radio } from 'lucide-react';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';

export const MembersPanel = ({
  activeUsers = [],
  currentUser,
  roomOwnerId,
  voice,
  onClose
}) => {
  const isHost = roomOwnerId === currentUser?.id;
  const inVoice = voice?.inVoice || false;
  const voiceUsers = voice?.voiceUsers || [];
  const mutedPeerSocketIds = voice?.mutedPeerSocketIds || new Set();

  // Separate members into In Voice vs. Other Online Members
  const inVoiceUserIds = new Set(voiceUsers.map(v => v.userId));
  if (inVoice && currentUser?.id) {
    inVoiceUserIds.add(currentUser.id);
  }

  return (
    <div className="flex flex-col h-full bg-[#252526] w-72 sm:w-80 shrink-0 overflow-hidden border-l border-white/10 select-text">
      {/* Header */}
      <div className="px-4 py-3 bg-[#1e1e1e] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-indigo-500/20 text-indigo-400">
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Members & Voice
            </h3>
            <p className="text-[10px] text-gray-400">{activeUsers.length} online collaborators</p>
          </div>
        </div>
        <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {voiceUsers.length + (inVoice ? 1 : 0)} in Voice
        </span>
      </div>

      {/* Voice Channel Quick Join/Leave Banner */}
      <div className="p-3 bg-[#202021] border-b border-white/10 shrink-0">
        {!inVoice ? (
          <button
            onClick={voice.joinVoice}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md active:scale-95 border border-indigo-400/30 group"
          >
            <Mic className="w-4 h-4 text-indigo-200 group-hover:animate-pulse" />
            <span>Join Voice Channel</span>
          </button>
        ) : (
          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <div className="text-xs font-semibold text-emerald-300">Voice Connected</div>
                <div className="text-[10px] text-gray-400 font-mono">
                  {voice.isMuted ? 'Mic Muted' : voice.isSpeaking ? 'Speaking...' : 'Ready'}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={voice.toggleMute}
                className={`p-1.5 rounded-md transition-colors ${
                  voice.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-emerald-400 hover:bg-white/15'
                }`}
                title={voice.isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {voice.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={voice.leaveVoice}
                className="p-1.5 rounded-md bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                title="Disconnect Voice"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Members Scroll List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {/* Section: In Voice Channel */}
        {(inVoice || voiceUsers.length > 0) && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                In Voice Channel ({voiceUsers.length + (inVoice ? 1 : 0)})
              </span>
            </div>

            <div className="space-y-1.5">
              {/* Current User in Voice */}
              {inVoice && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className={`relative rounded-full p-0.5 transition-all ${
                      voice.isSpeaking ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#1e1e1e]' : ''
                    }`}>
                      <AvatarDisplay avatarUrl={currentUser?.avatarUrl} name={currentUser?.name || currentUser?.username} size={24} />
                      {voice.isMuted && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-red-600 rounded-full p-0.5 text-white">
                          <MicOff className="w-2 h-2" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">{currentUser?.name || currentUser?.username}</span>
                        <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-mono">You</span>
                        {isHost && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono border border-amber-500/30 flex items-center gap-0.5">
                            <Shield className="w-2.5 h-2.5" /> Host
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {voice.isMuted ? 'Muted' : voice.isSpeaking ? 'Speaking...' : 'Listening'}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Own Mute */}
                  <button
                    onClick={voice.toggleMute}
                    className={`p-1.5 rounded-md transition-colors ${
                      voice.isMuted 
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                        : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                    }`}
                    title={voice.isMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    {voice.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              {/* Other Peers in Voice */}
              {voiceUsers.map((u) => {
                const isPeerMutedLocally = mutedPeerSocketIds.has(u.socketId);
                const isUserHost = u.userId === roomOwnerId;

                return (
                  <div key={u.socketId} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className={`relative rounded-full p-0.5 transition-all ${
                        u.isSpeaking ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#1e1e1e]' : ''
                      }`}>
                        <AvatarDisplay avatarUrl={u.user?.avatarUrl} name={u.user?.name || u.user?.username} size={24} />
                        {u.isMuted && (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-red-600 rounded-full p-0.5 text-white">
                            <MicOff className="w-2 h-2" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-200 truncate">{u.user?.name || u.user?.username || 'User'}</span>
                          {isUserHost && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono border border-amber-500/30 flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5" /> Host
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {isPeerMutedLocally ? 'Muted for you' : u.isMuted ? 'Muted' : u.isSpeaking ? 'Speaking...' : 'Listening'}
                        </div>
                      </div>
                    </div>

                    {/* Google Meet style Mute Controls for Peers */}
                    <div className="flex items-center space-x-1 shrink-0">
                      {/* Local Peer Mute Button */}
                      <button
                        onClick={() => voice.toggleMutePeer(u.socketId)}
                        className={`p-1.5 rounded-md transition-colors ${
                          isPeerMutedLocally 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                        title={isPeerMutedLocally ? "Unmute user for you" : "Mute user for you (Google Meet style)"}
                      >
                        {isPeerMutedLocally ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <MicOff className="w-3.5 h-3.5" />}
                      </button>

                      {/* Host Remote Mute if current user is owner */}
                      {isHost && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Mute ${u.user?.name || 'this user'} for everyone?`)) {
                              voice.hostMuteUser(u.socketId, u.userId);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                          title="Host Mute (Mute for everyone in room)"
                        >
                          <MicOff className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Online Room Members */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
            Online Members ({activeUsers.length})
          </div>

          <div className="space-y-1.5">
            {activeUsers.map((u, i) => {
              const uId = u.id || u.userId || u;
              const isUserInVoice = inVoiceUserIds.has(uId);
              const isCurrent = uId === currentUser?.id;
              const isUserHost = uId === roomOwnerId;
              const displayName = u.name || u.username || (typeof u === 'string' ? u : 'Member');

              return (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="relative">
                      <AvatarDisplay avatarUrl={u.avatarUrl} name={displayName} size={22} />
                      <div className="w-2 h-2 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-[#252526]" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-200 font-medium truncate">{displayName}</span>
                        {isCurrent && <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 py-0.2 rounded font-mono">You</span>}
                        {isUserHost && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono border border-amber-500/30 flex items-center gap-0.5">
                            <Shield className="w-2.5 h-2.5" /> Host
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {isUserInVoice ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Radio className="w-2.5 h-2.5" /> In Voice
                          </span>
                        ) : (
                          'Online'
                        )}
                      </div>
                    </div>
                  </div>

                  {isUserInVoice && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono border border-emerald-500/20">
                      Connected
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
