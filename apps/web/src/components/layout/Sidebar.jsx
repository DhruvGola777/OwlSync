import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FolderOpen, Settings as SettingsIcon, LogOut, Code2, Home } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Rooms', href: '/rooms', icon: FolderOpen },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

export const Sidebar = () => {
  const { logout } = useAuth();

  return (
    <div className="flex h-full flex-col bg-slate-900 w-64 border-r border-slate-800 text-slate-300 shadow-xl transition-all duration-300">
      <div className="flex h-16 shrink-0 items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/50">
        <Code2 className="h-8 w-8 text-indigo-500" />
        <span className="text-xl font-bold text-white tracking-tight">OwlSync</span>
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 gap-6">
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
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
