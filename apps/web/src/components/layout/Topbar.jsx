import React, { useState, useEffect } from 'react';
import { Search, Menu } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import AvatarDisplay from '../ui/AvatarDisplay';
import { FriendsMenu } from './FriendsMenu';
import { NotificationsMenu } from './NotificationsMenu';
import { CommandPalette } from '../ui/CommandPalette';
import { useNavigate } from 'react-router-dom';

export const Topbar = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global Ctrl + K / Cmd + K shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-500 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          {/* Interactive Global Search Trigger */}
          <div 
            onClick={() => setIsSearchOpen(true)}
            className="relative flex flex-1 items-center max-w-md cursor-pointer group"
          >
            <Search
              className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-slate-400 group-hover:text-indigo-600 transition-colors"
              aria-hidden="true"
            />
            <div className="block w-full py-1.5 pl-8 pr-12 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg group-hover:bg-slate-100 group-hover:border-slate-300 transition select-none flex items-center justify-between">
              <span>Search projects, rooms, users...</span>
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs text-slate-400 bg-white rounded border border-slate-200 font-mono">
                Ctrl K
              </kbd>
            </div>
          </div>
          
          <div className="flex flex-1 justify-end items-center gap-x-4 lg:gap-x-6">
            <FriendsMenu />
            <NotificationsMenu />
            
            <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" aria-hidden="true" />
            
            <div 
              onClick={() => user?.username && navigate(`/profile/${user.username}`)}
              className="flex items-center gap-x-4"
            >
              <div className="flex items-center gap-3 rounded-full bg-slate-50 py-1.5 px-3 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <AvatarDisplay avatarUrl={user?.avatarUrl} name={user?.name || user?.username} size={32} />
                <span className="text-sm font-medium text-slate-700 hidden sm:block">
                  {user?.name || user?.username}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Global Command Palette Search Modal */}
      <CommandPalette 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </>
  );
};
