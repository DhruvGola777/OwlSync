import React from 'react';
import { Mic, MicOff, Headphones, VolumeX, PhoneCall, PhoneOff, Radio, Users } from 'lucide-react';
import AvatarDisplay from '../../../components/ui/AvatarDisplay';

export const VoiceControlBar = ({
  inVoice,
  isMuted,
  isDeafened,
  isSpeaking,
  voiceUsers = [],
  currentUser,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen
}) => {
  if (!inVoice) {
    return (
      <button
        onClick={onJoinVoice}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition-all shadow-sm active:scale-95 group shrink-0"
        title="Join Voice Channel (WebRTC Audio)"
      >
        <Mic className="w-3.5 h-3.5 text-indigo-400 group-hover:animate-pulse" />
        <span>Join Voice</span>
        {voiceUsers.length > 0 && (
          <span className="text-[10px] bg-indigo-500/40 text-indigo-200 px-1.5 py-0.2 rounded font-mono">
            {voiceUsers.length}
          </span>
        )}
      </button>
    );
  }

  // Active voice bar
  return (
    <div className="flex items-center space-x-2 bg-gradient-to-r from-emerald-950/70 via-[#252526] to-[#1e1e1e] border border-emerald-500/40 px-2.5 py-1 rounded-md text-xs text-gray-200 shrink-0 shadow-md">
      {/* Voice Status Indicator */}
      <div className="flex items-center space-x-1.5">
        <div className="relative flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute" />
          <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
        </div>
        <span className="font-semibold text-emerald-400 text-[11px] hidden sm:inline">Voice Connected</span>
      </div>

      <div className="h-3.5 w-[1px] bg-white/10 shrink-0" />

      {/* Connected Voice Avatars with Speaking Glowing Rings */}
      <div className="flex items-center -space-x-1.5 overflow-hidden max-w-[140px] sm:max-w-[200px]">
        {/* Current User Avatar */}
        <div 
          className={`relative rounded-full transition-all duration-150 p-0.5 ${
            isSpeaking ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#1e1e1e] scale-105' : ''
          }`}
          title={`${currentUser?.name || 'You'} ${isMuted ? '(Muted)' : isSpeaking ? '(Speaking)' : ''}`}
        >
          <AvatarDisplay 
            avatarUrl={currentUser?.avatarUrl} 
            name={currentUser?.name || currentUser?.username || 'You'} 
            size={18} 
          />
          {isMuted && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-red-600 rounded-full p-0.5 text-white">
              <MicOff className="w-2 h-2" />
            </div>
          )}
        </div>

        {/* Remote Users Avatars */}
        {voiceUsers.map((u) => (
          <div 
            key={u.socketId}
            className={`relative rounded-full transition-all duration-150 p-0.5 ${
              u.isSpeaking ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#1e1e1e] scale-105' : ''
            }`}
            title={`${u.user?.name || u.user?.username || 'Peer'} ${u.isMuted ? '(Muted)' : u.isSpeaking ? '(Speaking)' : ''}`}
          >
            <AvatarDisplay 
              avatarUrl={u.user?.avatarUrl} 
              name={u.user?.name || u.user?.username || 'User'} 
              size={18} 
            />
            {u.isMuted && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-red-600 rounded-full p-0.5 text-white">
                <MicOff className="w-2 h-2" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="h-3.5 w-[1px] bg-white/10 shrink-0" />

      {/* Controls: Mute / Deafen / Leave */}
      <div className="flex items-center space-x-1">
        {/* Mute Button */}
        <button
          onClick={onToggleMute}
          className={`p-1 rounded transition-colors ${
            isMuted 
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
        </button>

        {/* Deafen Button */}
        <button
          onClick={onToggleDeafen}
          className={`p-1 rounded transition-colors ${
            isDeafened 
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
              : 'text-gray-300 hover:text-white hover:bg-white/10'
          }`}
          title={isDeafened ? "Undeafen Audio" : "Deafen Room Audio"}
        >
          {isDeafened ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Headphones className="w-3.5 h-3.5 text-indigo-300" />}
        </button>

        {/* Leave Voice Button */}
        <button
          onClick={onLeaveVoice}
          className="p-1 rounded bg-red-600/80 hover:bg-red-600 text-white transition-colors shadow-sm active:scale-95 ml-0.5"
          title="Disconnect Voice"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
