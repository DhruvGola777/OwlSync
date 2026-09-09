import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { format } from 'date-fns';
import { 
  VscEdit, VscNewFile, VscSignIn, VscSignOut, VscCode, 
  VscComment, VscTrash, VscFolder, VscTerminal, VscPlay,
  VscFilter, VscPerson, VscHistory
} from 'react-icons/vsc';
import { Sparkles, User, Users, FileCode, CheckCircle2, X } from 'lucide-react';

const getActivityIcon = (type) => {
  switch (type) {
    case 'FILE_EDITED': return <VscEdit className="text-blue-400 w-3.5 h-3.5" />;
    case 'FILE_CREATED': return <VscNewFile className="text-emerald-400 w-3.5 h-3.5" />;
    case 'FILE_DELETED': return <VscTrash className="text-rose-400 w-3.5 h-3.5" />;
    case 'FILE_RENAMED': return <VscEdit className="text-amber-400 w-3.5 h-3.5" />;
    case 'FOLDER_CREATED': return <VscFolder className="text-yellow-400 w-3.5 h-3.5" />;
    case 'FOLDER_DELETED': return <VscTrash className="text-rose-400 w-3.5 h-3.5" />;
    case 'TERMINAL_OPEN': return <VscTerminal className="text-purple-400 w-3.5 h-3.5" />;
    case 'TERMINAL_COMMAND': return <VscTerminal className="text-indigo-400 w-3.5 h-3.5" />;
    case 'CODE_EXECUTED': return <VscPlay className="text-amber-400 w-3.5 h-3.5" />;
    case 'USER_JOINED': return <VscSignIn className="text-green-400 w-3.5 h-3.5" />;
    case 'USER_LEFT': return <VscSignOut className="text-gray-400 w-3.5 h-3.5" />;
    default: return <VscComment className="text-gray-400 w-3.5 h-3.5" />;
  }
};

// Extract author name from activity description
const parseAuthor = (desc = '') => {
  if (desc.toLowerCase().includes('agent') || desc.toLowerCase().includes('ai')) {
    return 'OwlSync AI';
  }
  const match = desc.match(/^([a-zA-Z0-9_\- ]+?)\s+(created|edited|deleted|renamed|joined|left|ran|executed)/i);
  if (match) {
    return match[1].trim();
  }
  return 'Collaborator';
};

export const TimelinePanel = ({ projectId, isProjectMode, onClose }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuthor, setSelectedAuthor] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  useEffect(() => {
    let socket;
    let isDisposed = false;

    const fetchActivities = async () => {
      try {
        const data = await api.getActivities(projectId);
        if (!isDisposed) {
          setActivities(data || []);
        }
      } catch (error) {
        console.error('Failed to load activities', error);
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };

    fetchActivities();

    if (!isProjectMode) {
      socket = socketService.getSocket();
      if (socket) {
        const handleNewActivity = (activity) => {
          if (!activity) return;
          setActivities((prev) => {
            if (prev.some((a) => a.id === activity.id)) return prev;
            return [activity, ...prev];
          });
        };
        socket.on('project:activity', handleNewActivity);

        return () => {
          socket.off('project:activity', handleNewActivity);
          isDisposed = true;
        };
      }
    }

    return () => {
      isDisposed = true;
    };
  }, [projectId, isProjectMode]);

  // Compute Authors Breakdown & Stats ("Who wrote which part")
  const authorStats = useMemo(() => {
    const stats = {};
    activities.forEach(a => {
      const author = parseAuthor(a.description);
      stats[author] = (stats[author] || 0) + 1;
    });
    return Object.entries(stats).map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / Math.max(1, activities.length)) * 100)
    })).sort((a, b) => b.count - a.count);
  }, [activities]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      if (selectedAuthor !== 'ALL') {
        const author = parseAuthor(a.description);
        if (author !== selectedAuthor) return false;
      }
      if (selectedCategory === 'CODE') {
        if (!a.type.startsWith('FILE_')) return false;
      } else if (selectedCategory === 'TERMINAL') {
        if (!a.type.startsWith('TERMINAL_') && a.type !== 'CODE_EXECUTED') return false;
      } else if (selectedCategory === 'MEMBERS') {
        if (!a.type.startsWith('USER_')) return false;
      }
      return true;
    });
  }, [activities, selectedAuthor, selectedCategory]);

  if (loading) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center text-sm text-gray-500 bg-[#252526]">
        Loading timeline & authorship...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#252526] w-full select-text overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#1e1e1e] border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-indigo-500/20 text-indigo-400">
            <VscHistory className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Authorship Timeline
            </h3>
            <p className="text-[10px] text-gray-400">Who wrote what & room history replay</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
            {activities.length} events
          </span>
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

      {/* Contributor Authorship Breakdown */}
      {authorStats.length > 0 && (
        <div className="p-3 bg-[#202021] border-b border-white/10 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center justify-between">
            <span>Collaborator Contributions</span>
            <span className="text-[9px] text-indigo-300 font-mono">click to filter</span>
          </div>

          <div className="space-y-1.5">
            {authorStats.map((stat) => (
              <div 
                key={stat.name}
                onClick={() => setSelectedAuthor(prev => prev === stat.name ? 'ALL' : stat.name)}
                className={`p-1.5 rounded cursor-pointer transition-all ${
                  selectedAuthor === stat.name 
                    ? 'bg-indigo-600/30 border border-indigo-500/50' 
                    : 'bg-white/5 hover:bg-white/10 border border-white/5'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center space-x-1.5 truncate">
                    {stat.name === 'OwlSync AI' ? (
                      <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <User className="w-3 h-3 text-indigo-400 shrink-0" />
                    )}
                    <span className="text-gray-200 font-medium truncate">{stat.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">{stat.count} edits ({stat.percent}%)</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      stat.name === 'OwlSync AI' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${stat.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter Chips */}
      <div className="px-3 py-2 bg-[#252526] border-b border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {[
          { id: 'ALL', label: 'All' },
          { id: 'CODE', label: 'Code Edits' },
          { id: 'TERMINAL', label: 'Terminal' },
          { id: 'MEMBERS', label: 'Presence' }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0 ${
              selectedCategory === cat.id 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}

        {selectedAuthor !== 'ALL' && (
          <button
            onClick={() => setSelectedAuthor('ALL')}
            className="ml-auto text-[10px] text-indigo-300 hover:text-white underline font-mono shrink-0"
          >
            Clear Author Filter
          </button>
        )}
      </div>
      
      {/* Activity Timeline List */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent">
        {filteredActivities.length === 0 ? (
          <div className="text-center text-gray-500 text-xs mt-10">
            No events match your filter.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity, index) => {
              const isLast = index === filteredActivities.length - 1;
              const author = parseAuthor(activity.description);
              
              return (
                <div key={activity.id} className="relative flex gap-3 group">
                  {!isLast && (
                    <div className="absolute left-[9px] top-6 bottom-[-20px] w-[1px] bg-white/10 group-hover:bg-white/20 transition-colors" />
                  )}
                  
                  <div className="relative z-10 flex shrink-0 items-center justify-center w-5 h-5 rounded-full bg-[#1e1e1e] border border-white/10 mt-0.5">
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div className="flex flex-col flex-1 pb-1">
                    <div className="text-[12px] text-gray-200 leading-relaxed">
                      {activity.description}
                    </div>

                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950/60 border border-indigo-500/20 px-1.5 py-0.2 rounded">
                        @{author}
                      </span>
                      <span className="text-[10.5px] text-gray-500 font-mono">
                        {format(new Date(activity.createdAt), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
