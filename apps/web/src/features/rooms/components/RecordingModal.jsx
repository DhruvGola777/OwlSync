import React from 'react';
import { Download, X, Play, Video, CheckCircle2, Film, Clock } from 'lucide-react';

export const RecordingModal = ({
  isOpen,
  onClose,
  blobUrl,
  blob,
  formattedDuration,
  onDownload
}) => {
  if (!isOpen || !blobUrl) return null;

  const fileSizeMB = blob ? (blob.size / (1024 * 1024)).toFixed(2) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#252526] border border-white/15 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#1e1e1e] border-b border-white/10">
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
              <p className="text-[11px] text-gray-400">Review your pair programming session video & mixed audio</p>
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
        <div className="bg-black relative aspect-video flex items-center justify-center overflow-hidden border-b border-white/10">
          <video
            src={blobUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        {/* Footer Meta & Actions */}
        <div className="px-5 py-3 bg-[#1e1e1e] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-4 text-xs text-gray-400 font-mono">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Duration: <strong className="text-gray-200">{formattedDuration}</strong></span>
            </div>
            <div className="h-3 w-[1px] bg-white/10" />
            <div>
              <span>File Size: <strong className="text-gray-200">{fileSizeMB} MB</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-all border border-white/10"
            >
              Close
            </button>

            <button
              onClick={() => onDownload()}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md active:scale-95 border border-indigo-400/30"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Video (.webm)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
