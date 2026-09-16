import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

export const WindowControls = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.isDesktop);

  useEffect(() => {
    if (!isDesktop) return;

    window.electronAPI.isWindowMaximized().then(setIsMaximized);

    const cleanup = window.electronAPI.onMaximizedChange((maximized) => {
      setIsMaximized(maximized);
    });

    return cleanup;
  }, [isDesktop]);

  if (!isDesktop) return null;

  return (
    <div className="flex items-center h-full select-none ml-2" style={{ WebkitAppRegion: 'no-drag' }}>
      <button
        onClick={() => window.electronAPI.minimizeWindow()}
        className="h-full px-3 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
        title="Minimize"
      >
        <Minus size={14} />
      </button>

      <button
        onClick={async () => {
          const nowMaximized = await window.electronAPI.maximizeWindow();
          setIsMaximized(nowMaximized);
        }}
        className="h-full px-3 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? <Copy size={12} className="rotate-90" /> : <Square size={12} />}
      </button>

      <button
        onClick={() => window.electronAPI.closeWindow()}
        className="h-full px-3.5 hover:bg-red-600 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
        title="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
};
