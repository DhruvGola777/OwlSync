import React, { useState, useEffect, useMemo } from 'react';
import { 
  Film, Play, Download, Trash2, Edit3, Search, Clock, HardDrive, 
  Calendar, Check, X, AlertCircle, Share2, Video, Sparkles, ExternalLink
} from 'lucide-react';
import { api } from '../../../services/api';
import { formatDistanceToNow } from 'date-fns';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');

export const RecordingsPage = () => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState(null);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getRecordings();
      setRecordings(data || []);
    } catch (err) {
      console.error('Failed to load recordings:', err);
      setError(err.message || 'Failed to fetch recordings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  const filteredRecordings = useMemo(() => {
    if (!searchQuery.trim()) return recordings;
    const q = searchQuery.toLowerCase();
    return recordings.filter(r => 
      r.title?.toLowerCase().includes(q) || 
      r.description?.toLowerCase().includes(q)
    );
  }, [recordings, searchQuery]);

  const stats = useMemo(() => {
    const totalCount = recordings.length;
    const totalDurationSeconds = recordings.reduce((acc, r) => acc + (r.duration || 0), 0);
    const totalSizeBytes = recordings.reduce((acc, r) => acc + (r.size || 0), 0);

    const formatTime = (secs) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };

    const formatMB = (bytes) => {
      if (!bytes) return '0 MB';
      const mb = bytes / (1024 * 1024);
      if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
      return `${mb.toFixed(1)} MB`;
    };

    return {
      totalCount,
      totalDuration: formatTime(totalDurationSeconds),
      totalSize: formatMB(totalSizeBytes)
    };
  }, [recordings]);

  const handleDelete = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      try {
        await api.deleteRecording(id);
        setRecordings(prev => prev.filter(r => r.id !== id));
        if (selectedRecording?.id === id) {
          setSelectedRecording(null);
        }
      } catch (err) {
        alert('Failed to delete recording: ' + err.message);
      }
    }
  };

  const handleStartRename = (rec) => {
    setEditingId(rec.id);
    setEditTitle(rec.title);
  };

  const handleSaveRename = async (id) => {
    if (!editTitle.trim()) return;
    try {
      const updated = await api.updateRecording(id, { title: editTitle.trim() });
      setRecordings(prev => prev.map(r => r.id === id ? { ...r, title: updated.title } : r));
      if (selectedRecording?.id === id) {
        setSelectedRecording(prev => ({ ...prev, title: updated.title }));
      }
      setEditingId(null);
    } catch (err) {
      alert('Failed to update title: ' + err.message);
    }
  };

  const handleCopyLink = (rec) => {
    const fullUrl = `${API_ORIGIN}${rec.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(rec.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDuration = (totalSeconds) => {
    if (!totalSeconds) return '00:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Session Recordings</h1>
              <p className="text-sm text-slate-500">
                Review, playback, download and export your coding tests and live pair sessions
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-center min-w-[90px]">
            <div className="text-xs text-slate-500 font-medium">Recordings</div>
            <div className="text-lg font-bold text-slate-900">{stats.totalCount}</div>
          </div>
          <div className="px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-center min-w-[100px]">
            <div className="text-xs text-slate-500 font-medium">Total Time</div>
            <div className="text-lg font-bold text-indigo-600">{stats.totalDuration}</div>
          </div>
          <div className="px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-center min-w-[90px]">
            <div className="text-xs text-slate-500 font-medium">Storage</div>
            <div className="text-lg font-bold text-slate-900">{stats.totalSize}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recordings by title..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400"
          />
        </div>

        <button
          onClick={fetchRecordings}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
        >
          Refresh
        </button>
      </div>

      {/* Recordings Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading recordings library...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80 text-center px-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
          <p className="text-base font-semibold text-slate-800">Failed to load recordings</p>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button
            onClick={fetchRecordings}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
          >
            Try Again
          </button>
        </div>
      ) : filteredRecordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4 border border-indigo-100">
            <Video className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            {searchQuery ? 'No recordings match your search' : 'No session recordings yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mb-6">
            {searchQuery
              ? `We couldn't find any recordings matching "${searchQuery}". Try clearing the search.`
              : 'Record any room session or coding test using the Record button in the top menu bar. Your saved recordings will show up here.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecordings.map((rec) => {
            const videoUrl = `${API_ORIGIN}${rec.url}`;
            const thumbUrl = rec.thumbnailUrl ? `${API_ORIGIN}${rec.thumbnailUrl}` : null;
            const sizeMB = rec.size ? (rec.size / (1024 * 1024)).toFixed(1) : '0';
            const timeAgo = rec.createdAt ? formatDistanceToNow(new Date(rec.createdAt), { addSuffix: true }) : '';

            return (
              <div 
                key={rec.id}
                className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group"
              >
                {/* Video Preview Card Top */}
                <div 
                  onClick={() => setSelectedRecording(rec)}
                  className="relative aspect-video bg-slate-900 cursor-pointer overflow-hidden flex items-center justify-center group/preview"
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={rec.title}
                      className="w-full h-full object-cover opacity-85 group-hover/preview:opacity-100 transition-opacity"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <video 
                      src={videoUrl}
                      className="w-full h-full object-cover opacity-80 group-hover/preview:opacity-100 transition-opacity"
                      preload="metadata"
                    />
                  )}
                  
                  {/* Play Overlay Badge */}
                  <div className="absolute inset-0 bg-slate-950/40 group-hover/preview:bg-slate-950/20 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg transform group-hover/preview:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Duration Pill Tag */}
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded-md text-[11px] font-mono text-white font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>{formatDuration(rec.duration)}</span>
                  </div>
                </div>

                {/* Video Info Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {editingId === rec.id ? (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(rec.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="flex-1 px-2.5 py-1 text-sm bg-slate-50 border border-indigo-500 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => handleSaveRename(rec.id)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 
                          onClick={() => setSelectedRecording(rec)}
                          className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors line-clamp-2 cursor-pointer"
                          title={rec.title}
                        >
                          {rec.title}
                        </h3>
                        <button
                          onClick={() => handleStartRename(rec)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded transition-all shrink-0"
                          title="Rename Title"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {timeAgo}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5" />
                        {sizeMB} MB
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedRecording(rec)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-indigo-600" />
                      <span>Watch</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyLink(rec)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors relative"
                        title="Copy Video URL"
                      >
                        {copiedId === rec.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </button>

                      <a
                        href={videoUrl}
                        download={`${rec.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Download Video File (.webm)"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      <button
                        onClick={() => handleDelete(rec.id, rec.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Recording"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dedicated Interactive Video Player Modal */}
      {selectedRecording && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedRecording(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-950/80 border-b border-slate-800 shrink-0">
              <div className="min-w-0 pr-4">
                <h3 className="text-base font-bold text-white truncate">
                  {selectedRecording.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                  <span>Duration: {formatDuration(selectedRecording.duration)}</span>
                  <span>•</span>
                  <span>Size: {(selectedRecording.size / (1024 * 1024)).toFixed(1)} MB</span>
                  <span>•</span>
                  <span>{new Date(selectedRecording.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedRecording(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Box */}
            <div className="bg-black aspect-video flex items-center justify-center overflow-hidden">
              <video
                src={`${API_ORIGIN}${selectedRecording.url}`}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-3.5 bg-slate-950 flex items-center justify-between border-t border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyLink(selectedRecording)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-700"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copiedId === selectedRecording.id ? 'Copied Link!' : 'Copy Link'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <a
                  href={`${API_ORIGIN}${selectedRecording.url}`}
                  download={`${selectedRecording.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md active:scale-95 border border-indigo-400/30"
                >
                  <Download className="w-4 h-4" />
                  <span>Download (.webm)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
