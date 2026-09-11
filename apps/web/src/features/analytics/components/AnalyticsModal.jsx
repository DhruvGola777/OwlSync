import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Code2, 
  Bot, 
  Film, 
  DownloadCloud, 
  Activity, 
  X, 
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';
import { api } from '../../../services/api';

export const AnalyticsModal = ({ isOpen, onClose, workspaceId = null }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      let res;
      if (workspaceId) {
        res = await api.getWorkspaceAnalytics(workspaceId);
      } else {
        res = await api.getUserAnalytics();
      }
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load activity analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchAnalytics();
    }
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

  const totals = data?.totals || {
    FILE_SAVE: 0,
    AI_QUERY: 0,
    RECORDING_UPLOAD: 0,
    EXPORT_ZIP: 0,
    TOTAL_EVENTS: 0
  };

  const statCards = [
    {
      title: 'Code Edits & Saves',
      value: totals.FILE_SAVE || 0,
      icon: Code2,
      color: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400',
      unit: 'saves'
    },
    {
      title: 'AI Pair-Programmer Queries',
      value: totals.AI_QUERY || 0,
      icon: Bot,
      color: 'from-purple-500/20 to-indigo-500/20',
      border: 'border-purple-500/30',
      iconColor: 'text-purple-400',
      unit: 'prompts'
    },
    {
      title: 'Session Recordings',
      value: totals.RECORDING_UPLOAD || 0,
      icon: Film,
      color: 'from-rose-500/20 to-pink-500/20',
      border: 'border-rose-500/30',
      iconColor: 'text-rose-400',
      unit: 'videos'
    },
    {
      title: 'ZIP Codebase Exports',
      value: totals.EXPORT_ZIP || 0,
      icon: DownloadCloud,
      color: 'from-emerald-500/20 to-teal-500/20',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      unit: 'exports'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Developer Activity & Analytics
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Real-time Redis Engine
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                {workspaceId ? 'Workspace aggregation & event streaming' : 'Personal developer telemetry & usage statistics'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setRefreshing(true);
                fetchAnalytics();
              }}
              disabled={refreshing}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Streaming real-time metrics...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* Top Banner: Total Platform Events */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-transparent border border-indigo-500/20 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-indigo-200">Total Streamed Telemetry Events</div>
                    <div className="text-2xl font-black text-white font-mono">{totals.TOTAL_EVENTS || 0}</div>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 justify-end">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Asynchronous RabbitMQ Aggregator
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Latency overhead: ~0ms</div>
                </div>
              </div>

              {/* Grid of Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {statCards.map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <div 
                      key={i}
                      className={`p-4 rounded-xl bg-gradient-to-br ${card.color} border ${card.border} backdrop-blur-md relative overflow-hidden transition-all duration-200 hover:scale-[1.01]`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-300">{card.title}</span>
                        <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${card.iconColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-extrabold text-white font-mono">{card.value}</span>
                        <span className="text-xs text-gray-400 font-medium">{card.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent Activity Log */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Recent Audit Event Timeline
                </h3>
                
                {(!data?.recentEvents || data.recentEvents.length === 0) ? (
                  <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-gray-500">
                    No activity recorded yet. Start editing code, invoking AI, or exporting projects!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.recentEvents.map((evt) => (
                      <div 
                        key={evt.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-colors text-xs"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            evt.eventType === 'FILE_SAVE' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            evt.eventType === 'AI_QUERY' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            evt.eventType === 'RECORDING_UPLOAD' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            evt.eventType === 'EXPORT_ZIP' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                          }`}>
                            {evt.eventType}
                          </span>
                          <span className="text-gray-300 font-mono">
                            {evt.metadata?.path || evt.metadata?.projectName || (evt.metadata?.type ? `AI ${evt.metadata.type}` : 'System Action')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-gray-500 text-[11px]">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="text-[11px] text-gray-500">
            OwlSync High-Throughput Event Telemetry Engine
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
