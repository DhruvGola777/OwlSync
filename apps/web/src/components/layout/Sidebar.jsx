import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, FolderOpen, Settings as SettingsIcon, LogOut, Code2, Globe, Film, Download } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

export const Sidebar = ({ isSidebarOpen }) => {
  const { logout } = useAuth();
  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;

  const baseNavItems = [
    { name: 'Projects', href: '/projects', icon: FolderOpen },
    { name: 'Rooms', href: '/rooms', icon: Globe },
    { name: 'Recordings', href: '/recordings', icon: Film },
    { name: 'Team', href: '/team', icon: Users },
    ...(!isDesktop ? [{ name: 'Download Desktop', href: '/download', icon: Download }] : []),
  ];

  return (
    <div className={`flex h-full flex-col bg-slate-900 border-r border-slate-800 text-slate-300 shadow-xl transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0 border-r-0'}`}>
      <div className="flex h-16 shrink-0 items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/50">
        <img src="/logo.png" alt="OwlSync" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
        <span className="text-xl font-bold text-white tracking-tight">OwlSync</span>
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 gap-6">
        <nav className="flex-1 space-y-1">
          {baseNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                }`
              }
            >
              <item.icon
                className="mr-3 h-5 w-5 shrink-0 transition-colors"
                aria-hidden="true"
              />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
      
      <div className="border-t border-slate-800 p-4">
        <nav className="space-y-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
              }`
            }
          >
            <SettingsIcon className="mr-3 h-5 w-5 shrink-0" />
            Settings
          </NavLink>
          <button
            onClick={() => logout()}
            className="w-full group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 shrink-0" />
            Sign out
          </button>
        </nav>
      </div>
    </div>
  );
};
