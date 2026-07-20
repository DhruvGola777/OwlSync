import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { api } from '../../../services/api';
import { AuthLayout } from '../components/AuthLayout';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!token) {
    return (
      <AuthLayout title="Invalid Request" subtitle="No reset token provided.">
        <div className="text-center">
          <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-500 font-medium">
            Request a new password reset
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      await api.resetPassword(token, password);
      // Reusing the verified success param logic or just adding a specific one
      navigate('/login?verified=true'); 
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Set new password">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Input
          label="New Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm New Password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  );
};
