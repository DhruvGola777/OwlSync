import React, { useState, useEffect, useRef } from 'react';
import { Tldraw, createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { socketService } from '../../../services/socket';
import { api } from '../../../services/api';
import { useTheme } from '../../../providers/ThemeProvider';

const safeGetSnapshot = (st) => {
  try {
    if (!st) return null;
    if (typeof getSnapshot === 'function') {
      return getSnapshot(st);
    }
    if (typeof st.getSnapshot === 'function') {
      return st.getSnapshot();
    }
  } catch (e) {
    console.error('Error getting whiteboard snapshot:', e);
  }
  return null;
};

const safeLoadSnapshot = (st, snapshot) => {
  try {
    if (!st || !snapshot) return;
    if (typeof loadSnapshot === 'function') {
      loadSnapshot(st, snapshot);
    } else if (typeof st.loadSnapshot === 'function') {
      st.loadSnapshot(snapshot);
    }
  } catch (e) {
    console.error('Error loading whiteboard snapshot:', e);
  }
};

export const WhiteboardPanel = ({ projectId, isProjectMode }) => {
  const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }));
  const [storeWithStatus, setStoreWithStatus] = useState({ status: 'loading' });
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    let socket;
    let isDisposed = false;
    let unlisten = null;

    async function init() {
      if (!projectId) {
        setStoreWithStatus({ status: 'loading' });
        return;
      }

      setStoreWithStatus({ status: 'loading' });

      try {
        if (!isProjectMode) {
          socket = socketService.getSocket();
        }

        // Fetch initial state from API
        const res = await api.getWhiteboard(projectId);
        let parsedState = null;
        if (res && res.state) {
          try {
            parsedState = typeof res.state === 'string' ? JSON.parse(res.state) : res.state;
          } catch (e) {
            console.error("Failed to parse whiteboard state", e);
          }
        }
        
        if (parsedState && store) {
          safeLoadSnapshot(store, parsedState);
        }

        if (isDisposed) return;

        if (!isProjectMode && socket) {
          socket.emit('whiteboard:join', { projectId });

          // We receive full sync from other clients just in case they have unsaved changes
          const handleSync = ({ state }) => {
            if (state && store) {
              safeLoadSnapshot(store, state);
            }
          };

          const handleRemoteUpdate = ({ update }) => {
            if (!store || !update) return;
            try {
              store.mergeRemoteChanges(() => {
                if (update.added && update.added.length) store.put(update.added);
                if (update.updated && update.updated.length) store.put(update.updated);
                if (update.removed && update.removed.length) store.remove(update.removed);
              });
            } catch (mergeErr) {
              console.error('Error merging remote whiteboard changes:', mergeErr);
            }
          };

          socket.on('whiteboard:sync', handleSync);
          socket.on('whiteboard:update', handleRemoteUpdate);

          // Listen for local user changes and broadcast diffs
          unlisten = store.listen(({ changes }) => {
            try {
              const added = Object.values(changes.added || {});
              const updated = Object.values(changes.updated || {}).map(([, to]) => to);
              const removed = Object.keys(changes.removed || {});
              
              socket.emit('whiteboard:update', { projectId, update: { added, updated, removed } });
              
              // Debounce save state to server
              clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = setTimeout(() => {
                const snapshot = safeGetSnapshot(store);
                if (snapshot) {
                  socket.emit('whiteboard:save', { projectId, state: snapshot });
                }
              }, 3000);
            } catch (err) {
              console.error('Error in whiteboard store listener:', err);
            }
          }, { source: 'user', scope: 'document' });

          setStoreWithStatus({ status: 'synced', store, unlisten, socket, handleSync, handleRemoteUpdate });

        } else {
          // Solo mode: just debounce save to REST API
          unlisten = store.listen(() => {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
              const snapshot = safeGetSnapshot(store);
              if (snapshot) {
                api.updateWhiteboard(projectId, JSON.stringify(snapshot)).catch(console.error);
              }
            }, 3000);
          }, { source: 'user', scope: 'document' });

          setStoreWithStatus({ status: 'synced', store, unlisten });
        }

      } catch (err) {
        console.error('Whiteboard init error:', err);
        if (!isDisposed) setStoreWithStatus({ status: 'error', error: err });
      }
    }
    
    init();

    return () => {
      isDisposed = true;
      try {
        if (typeof unlisten === 'function') unlisten();
        if (socket) {
          socket.off('whiteboard:sync');
          socket.off('whiteboard:update');
        }
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          const snapshot = safeGetSnapshot(store);
          if (snapshot && projectId) {
            api.updateWhiteboard(projectId, JSON.stringify(snapshot)).catch(console.error);
          }
        }
      } catch (cleanupErr) {
        console.error('Error during Whiteboard unmount cleanup:', cleanupErr);
      }
    };
  }, [projectId, isProjectMode, store]);

  const { theme } = useTheme();
  const [editor, setEditor] = useState(null);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (editor?.user?.updateUserPreferences) {
      try {
        editor.user.updateUserPreferences({ colorScheme: isDark ? 'dark' : 'light' });
      } catch (e) {
        console.error(e);
      }
    }
  }, [isDark, editor]);

  if (storeWithStatus.status === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#252526] text-gray-400">
        Loading Whiteboard...
      </div>
    );
  }

  if (storeWithStatus.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#252526] text-red-500">
        Failed to load Whiteboard
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full relative" style={{ zIndex: 10 }}>
      <Tldraw 
        store={storeWithStatus.store} 
        onMount={(ed) => {
          setEditor(ed);
          if (ed?.user?.updateUserPreferences) {
            try {
              ed.user.updateUserPreferences({ colorScheme: isDark ? 'dark' : 'light' });
            } catch (e) {}
          }
        }} 
      />
    </div>
  );
};
