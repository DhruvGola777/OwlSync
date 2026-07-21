import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import AvatarDisplay from '../ui/AvatarDisplay';
import { FriendsMenu } from './FriendsMenu';

export const Topbar = () => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <form className="relative flex flex-1" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-slate-900 placeholder:text-slate-400 focus:ring-0 sm:text-sm bg-transparent outline-none"
            placeholder="Search..."
            type="search"
            name="search"
          />
        </form>
        
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <FriendsMenu />
          <button type="button" className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-500 transition-colors">
            <span className="sr-only">View notifications</span>
            <Bell className="h-6 w-6" aria-hidden="true" />
          </button>
          
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" aria-hidden="true" />
          
          <div className="flex items-center gap-x-4">
            <div className="flex items-center gap-3 rounded-full bg-slate-50 py-1.5 px-3 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
              <AvatarDisplay avatarUrl={user?.avatarUrl} name={user?.name || user?.username} size={32} />
              <span className="text-sm font-medium text-slate-700 hidden sm:block">
                {user?.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
