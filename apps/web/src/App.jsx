import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// A simple placeholder dashboard for now
const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome back, {user.name}!
        </h1>
        <p className="text-gray-600 mb-8">
          This is your OwlSync dashboard. In the next phase, we'll build out the workspaces and projects UI here.
        </p>
        <button 
          onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
