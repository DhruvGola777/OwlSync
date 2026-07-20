import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '../features/auth/pages/Login';
import { Register } from '../features/auth/pages/Register';
import Settings from '../features/users/pages/Settings.jsx';
import { ForgotPassword } from '../features/auth/pages/ForgotPassword';
import { ResetPassword } from '../features/auth/pages/ResetPassword';
import { MagicLink } from '../features/auth/pages/MagicLink';
import { Dashboard } from '../features/dashboard/pages/Dashboard';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardLayout } from '../components/layout/DashboardLayout';

export const AppRouter = () => {
  return (
    <Routes>
      {/* Public / Auth Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/auth/magic-link" element={<MagicLink />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workspaces" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-800">Workspaces</h1><p className="mt-2 text-slate-600">Coming soon...</p></div>} />
          <Route path="/projects" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-800">Projects</h1><p className="mt-2 text-slate-600">Coming soon...</p></div>} />
          <Route path="/tasks" element={<div className="p-8"><h1 className="text-2xl font-bold text-slate-800">Tasks</h1><p className="mt-2 text-slate-600">Coming soon...</p></div>} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
};
