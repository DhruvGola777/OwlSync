import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { socketService } from '../../../services/socket';
import { format } from 'date-fns';
import { VscEdit, VscNewFile, VscSignIn, VscCode, VscComment } from 'react-icons/vsc';

const getActivityIcon = (type) => {
  switch (type) {
    case 'FILE_EDITED': return <VscEdit className="text-blue-400 w-4 h-4" />;
    case 'FILE_CREATED': return <VscNewFile className="text-emerald-400 w-4 h-4" />;
    case 'USER_JOINED': return <VscSignIn className="text-green-400 w-4 h-4" />;
    case 'CODE_EXECUTED': return <VscCode className="text-amber-400 w-4 h-4" />;
    default: return <VscComment className="text-gray-400 w-4 h-4" />;
  }
};

export const TimelinePanel = ({ projectId, isProjectMode }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

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
          setActivities((prev) => [activity, ...prev]);
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-500 bg-[#252526] h-full">
        Loading timeline...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#252526] w-80 shrink-0 border-l border-white/10">
      <div className="px-4 py-2 text-[13px] font-bold text-white tracking-wider uppercase h-[44px] flex items-center border-b border-white/10 shrink-0">
        Session Timeline
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 scrollbar-track-transparent">
        {activities.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-10">
            No activity yet.
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const isFirst = index === 0;
              const isLast = index === activities.length - 1;
              
              return (
                <div key={activity.id} className="relative flex gap-3 group">
                  {!isLast && (
                    <div className="absolute left-[9px] top-6 bottom-[-20px] w-[1px] bg-white/10 group-hover:bg-white/20 transition-colors" />
                  )}
                  
                  <div className="relative z-10 flex shrink-0 items-center justify-center w-5 h-5 rounded-full bg-[#1e1e1e] border border-white/10 mt-0.5">
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div className="flex flex-col flex-1 pb-1">
                    <div className="text-[13px] text-gray-200">
                      {activity.description}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                      {format(new Date(activity.createdAt), 'h:mm a')}
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
