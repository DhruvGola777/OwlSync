import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '../features/auth/pages/Login';
import { Register } from '../features/auth/pages/Register';
import Settings from '../features/users/pages/Settings.jsx';
import { ForgotPassword } from '../features/auth/pages/ForgotPassword';
import { ResetPassword } from '../features/auth/pages/ResetPassword';
import { MagicLink } from '../features/auth/pages/MagicLink';
import { ProjectsPage } from '../features/dashboard/pages/ProjectsPage';
import { RoomsPage } from '../features/dashboard/pages/RoomsPage';
import { RecordingsPage } from '../features/recordings/pages/RecordingsPage';
import { RoomView } from '../features/rooms/pages/RoomView';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import PublicProfile from '../features/users/pages/PublicProfile';
import { TeamsPage } from '../features/teams/pages/TeamsPage';
import { DownloadPage } from '../features/landing/pages/DownloadPage';

export const AppRouter = () => {
  return (
    <Routes>
      {/* Public / Auth Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/download" element={<DownloadPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/auth/magic-link" element={<MagicLink />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        {/* Full-screen workspace IDE view */}
        <Route path="/room/:id" element={<RoomView />} />
        <Route path="/project/:id" element={<RoomView />} />
        
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Navigate to="/projects" replace />} />
          <Route path="/workspaces" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/recordings" element={<RecordingsPage />} />
          <Route path="/team" element={<TeamsPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/tasks" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-800">Tasks</h1><p className="mt-2 text-slate-600">Coming soon...</p></div>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile/:username" element={<PublicProfile />} />
        </Route>
      </Route>
    </Routes>
  );
};
