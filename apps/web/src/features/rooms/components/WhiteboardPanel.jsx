import React, { useState, useEffect, useRef } from 'react';
import { Tldraw, createTLStore, defaultShapeUtils } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { socketService } from '../../../services/socket';
import { api } from '../../../services/api';
import { useTheme } from '../../../providers/ThemeProvider';

export const WhiteboardPanel = ({ projectId, isProjectMode }) => {
  const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }));
  const [storeWithStatus, setStoreWithStatus] = useState({ status: 'loading' });
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    let socket;
    let isDisposed = false;
    let unlisten = null;

    async function init() {
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
            parsedState = JSON.parse(res.state);
          } catch (e) {
            console.error("Failed to parse whiteboard state", e);
          }
        }
        
        if (parsedState) {
           store.loadSnapshot(parsedState);
        }

        if (isDisposed) return;

        if (!isProjectMode && socket) {
          socket.emit('whiteboard:join', { projectId });

          // We receive full sync from other clients just in case they have unsaved changes
          const handleSync = ({ state }) => {
            if (state) {
               store.loadSnapshot(state);
            }
          };

          const handleRemoteUpdate = ({ update }) => {
             store.mergeRemoteChanges(() => {
                if (update.added && update.added.length) store.put(update.added);
                if (update.updated && update.updated.length) store.put(update.updated);
                if (update.removed && update.removed.length) store.remove(update.removed);
             });
          };

          socket.on('whiteboard:sync', handleSync);
          socket.on('whiteboard:update', handleRemoteUpdate);

          // Listen for local user changes and broadcast diffs
          unlisten = store.listen(({ changes }) => {
             const added = Object.values(changes.added);
             const updated = Object.values(changes.updated).map(([from, to]) => to);
             const removed = Object.keys(changes.removed);
             
             socket.emit('whiteboard:update', { projectId, update: { added, updated, removed } });
             
             // Debounce save state to server
             clearTimeout(saveTimeoutRef.current);
             saveTimeoutRef.current = setTimeout(() => {
               socket.emit('whiteboard:save', { projectId, state: store.getSnapshot() });
             }, 3000);

          }, { source: 'user', scope: 'document' });

          setStoreWithStatus({ status: 'synced', store, unlisten, socket, handleSync, handleRemoteUpdate });

        } else {
          // Solo mode: just debounce save to REST API
          unlisten = store.listen(() => {
             clearTimeout(saveTimeoutRef.current);
             saveTimeoutRef.current = setTimeout(() => {
               api.updateWhiteboard(projectId, JSON.stringify(store.getSnapshot()));
             }, 3000);
          }, { source: 'user', scope: 'document' });

          setStoreWithStatus({ status: 'synced', store, unlisten });
        }

      } catch (err) {
        console.error(err);
        if (!isDisposed) setStoreWithStatus({ status: 'error', error: err });
      }
    }
    
    init();

    return () => {
      isDisposed = true;
      if (unlisten) unlisten();
      if (storeWithStatus.unlisten) storeWithStatus.unlisten();
      if (socket) {
        if (storeWithStatus.handleSync) socket.off('whiteboard:sync', storeWithStatus.handleSync);
        if (storeWithStatus.handleRemoteUpdate) socket.off('whiteboard:update', storeWithStatus.handleRemoteUpdate);
      }
      clearTimeout(saveTimeoutRef.current);
    };
  }, [projectId, isProjectMode, store]);

  const { theme } = useTheme();
  const [editor, setEditor] = useState(null);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (editor) {
      editor.user.updateUserPreferences({ colorScheme: isDark ? 'dark' : 'light' });
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
          ed.user.updateUserPreferences({ colorScheme: isDark ? 'dark' : 'light' });
        }} 
      />
    </div>
  );
};
