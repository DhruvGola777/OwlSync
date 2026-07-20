import React from 'react';
import { useAuth } from '../../../providers/AuthProvider';

export const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">
        Welcome back, {user?.name}!
      </h1>
      <p className="text-slate-600">
        This is your OwlSync dashboard. In the next phase, we'll build out the workspaces and projects UI here.
      </p>
    </div>
  );
};
