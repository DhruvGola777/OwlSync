import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';

export const MagicLink = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkAuth } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');
  
  const [error, setError] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('No magic link token provided.');
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const verifyToken = async () => {
      try {
        await api.verifyMagicLink(token);
        await checkAuth(); // Rehydrate user state from cookie
        navigate('/dashboard');
      } catch (err) {
        setError(err.message);
      }
    };

    verifyToken();
  }, [token, navigate, checkAuth]);

  if (error) {
    return (
      <AuthLayout title="Invalid Magic Link" subtitle="This link is invalid or has expired.">
        <div className="text-center">
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200 mb-6">
            {error}
          </p>
          <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Signing you in...">
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    </AuthLayout>
  );
};
