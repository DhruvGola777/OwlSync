import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { socketService } from '../../services/socket';
import { useAuth } from '../../providers/AuthProvider';

export const DashboardLayout = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      socketService.connect();
    }
    return () => {
      // We don't necessarily disconnect here because they might just be navigating to a RoomView
      // But actually, socketService is a singleton, so it handles reconnections.
    };
  }, [user]);
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
