import React, { useState } from 'react';
import { Download, X, Film, Clock, CloudUpload, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';

export const RecordingModal = ({
  isOpen,
  onClose,
  blobUrl,
  blob,
  formattedDuration,
  durationSeconds = 0,
  roomId,
  projectId,
  roomName,
  onDownload
}) => {
  const [title, setTitle] = useState(() => {
    const defaultName = roomName ? `${roomName} - Coding Session` : 'Room Coding Session';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${defaultName} (${dateStr})`;
  });
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (!isOpen || !blobUrl) return null;

  const fileSizeMB = blob ? (blob.size / (1024 * 1024)).toFixed(2) : '0';

  const handleSaveToCloud = async () => {
    if (!blob || isSaving || isSaved) return;

    try {
      setIsSaving(true);
      setSaveError(null);

      const formData = new FormData();
      const filename = `${title.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'recording'}.webm`;
      formData.append('file', blob, filename);
      formData.append('title', title.trim() || 'Session Recording');
      formData.append('description', description.trim());
      formData.append('duration', durationSeconds || 0);
      if (roomId) formData.append('roomId', roomId);
      if (projectId) formData.append('projectId', projectId);

      await api.uploadRecording(formData);
      setIsSaved(true);
    } catch (err) {
      console.error('Failed to upload recording:', err);
      setSaveError(err.message || 'Failed to save recording to cloud');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#252526] border border-white/15 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#1e1e1e] border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
              <Film className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Session Recording Ready
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                  HD WebM
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">Review your coding session video and save or download</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Player Area */}
        <div className="bg-black relative aspect-video max-h-[380px] flex items-center justify-center overflow-hidden border-b border-white/10 shrink-0">
          <video
            src={blobUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        {/* Content Form & Metadata */}
        <div className="p-4 bg-[#1e1e1e] space-y-3 overflow-y-auto">
          <div>
            <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-1">
              Recording Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. React Debugging Session, Python DSA Class"
              className="w-full px-3 py-1.5 bg-[#252526] border border-white/10 focus:border-indigo-500 rounded-md text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
            />
          </div>

          {saveError && (
            <div className="p-2 rounded bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
              {saveError}
            </div>
          )}

          {isSaved && (
            <div className="p-2.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Successfully saved to your <strong>Recordings</strong>! You can view and manage it from your dashboard.</span>
            </div>
          )}
        </div>

        {/* Footer Meta & Actions */}
        <div className="px-5 py-3 bg-[#181818] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-4 text-xs text-gray-400 font-mono">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Duration: <strong className="text-gray-200">{formattedDuration}</strong></span>
            </div>
            <div className="h-3 w-[1px] bg-white/10" />
            <div>
              <span>Size: <strong className="text-gray-200">{fileSizeMB} MB</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            <button
              onClick={() => onDownload(title ? `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm` : null)}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white rounded-md text-xs font-medium transition-all border border-white/10"
              title="Save directly to your computer Downloads folder"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.webm)</span>
            </button>

            <button
              onClick={handleSaveToCloud}
              disabled={isSaving || isSaved}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all shadow-md active:scale-95 border ${
                isSaved 
                  ? 'bg-emerald-600/80 border-emerald-500/50 text-white cursor-default'
                  : isSaving 
                  ? 'bg-indigo-600/60 border-indigo-500/30 text-white cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30 shadow-indigo-600/20'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isSaved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved in Recordings</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Save to My Recordings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
