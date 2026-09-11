import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Code2, Users, FolderCode, FileCode, ArrowRight, Loader2, X } from 'lucide-react';
import { api } from '../../services/api';
import AvatarDisplay from './AvatarDisplay';

export const CommandPalette = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ projects: [], rooms: [], users: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults({ projects: [], rooms: [], users: [], files: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults({ projects: [], rooms: [], users: [], files: [] });
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await api.globalSearch(query);
        setResults(data || { projects: [], rooms: [], users: [], files: [] });
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Flatten all items to allow smooth arrow navigation
  const flatItems = [
    ...(results.projects || []).map(item => ({ ...item, _type: 'project' })),
    ...(results.rooms || []).map(item => ({ ...item, _type: 'room' })),
    ...(results.users || []).map(item => ({ ...item, _type: 'user' })),
    ...(results.files || []).map(item => ({ ...item, _type: 'file' }))
  ];

  const handleSelect = (item) => {
    if (!item) return;
    onClose();
    if (item._type === 'project') {
      navigate(`/project/${item.id}`);
    } else if (item._type === 'room') {
      navigate(`/room/${item.id}`);
    } else if (item._type === 'user') {
      navigate(`/profile/${item.username}`);
    } else if (item._type === 'file') {
      navigate(`/project/${item.projectId}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleSelect(flatItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, rooms, users, or files... (Type at least 2 characters)"
            className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-base outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs text-slate-400 bg-slate-100 rounded border border-slate-200 font-mono">
            ESC
          </kbd>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-slate-100">
          {!query.trim() || query.trim().length < 2 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <p className="font-medium text-slate-600 mb-1">Quick Search</p>
              <p>Type to instantly find codebases, active rooms, teammates, or files.</p>
            </div>
          ) : flatItems.length === 0 && !loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No results found for "<span className="font-semibold text-slate-700">{query}</span>"
            </div>
          ) : (
            <>
              {/* Projects */}
              {results.projects?.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderCode size={13} />
                    Projects ({results.projects.length})
                  </div>
                  {results.projects.map((proj) => {
                    const idx = flatItems.findIndex(i => i._type === 'project' && i.id === proj.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={proj.id}
                        onClick={() => handleSelect({ ...proj, _type: 'project' })}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                          isSelected ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <FolderCode size={16} />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-semibold truncate">{proj.name}</p>
                            <p className="text-xs text-slate-400 truncate">{proj.description || 'Personal project'}</p>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-slate-400 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rooms */}
              {results.rooms?.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Code2 size={13} />
                    Live Rooms ({results.rooms.length})
                  </div>
                  {results.rooms.map((room) => {
                    const idx = flatItems.findIndex(i => i._type === 'room' && i.id === room.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={room.id}
                        onClick={() => handleSelect({ ...room, _type: 'room' })}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                          isSelected ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                            <Code2 size={16} />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-semibold truncate">{room.name}</p>
                            <p className="text-xs text-slate-400 truncate">Hosted by @{room.owner?.username || 'user'} • {room.language}</p>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium shrink-0">
                          Join Room
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Users */}
              {results.users?.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={13} />
                    Developers ({results.users.length})
                  </div>
                  {results.users.map((u) => {
                    const idx = flatItems.findIndex(i => i._type === 'user' && i.id === u.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleSelect({ ...u, _type: 'user' })}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                          isSelected ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarDisplay avatarUrl={u.avatarUrl} name={u.name || u.username} size={32} />
                          <div className="truncate">
                            <p className="text-sm font-semibold truncate">{u.name || u.username}</p>
                            <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                          </div>
                        </div>
                        <span className="text-xs text-indigo-600 font-medium hover:underline shrink-0">
                          View Profile
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Files */}
              {results.files?.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode size={13} />
                    Project Files ({results.files.length})
                  </div>
                  {results.files.map((file) => {
                    const idx = flatItems.findIndex(i => i._type === 'file' && i.id === file.id);
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleSelect({ ...file, _type: 'file' })}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                          isSelected ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                            <FileCode size={16} />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-semibold font-mono truncate">{file.name}</p>
                            <p className="text-xs text-slate-400 truncate">{file.path} in {file.project?.name}</p>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-slate-400 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white border border-slate-200 px-1 py-0.5 rounded">↑↓</kbd> to navigate</span>
            <span><kbd className="font-mono bg-white border border-slate-200 px-1 py-0.5 rounded">↵</kbd> to select</span>
          </div>
          <span>OwlSync Global Search</span>
        </div>
      </div>
    </div>
  );
};
export default CommandPalette;
