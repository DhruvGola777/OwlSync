import React, { useState } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../../providers/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';
import { api } from '../../../services/api';

export const Login = () => {
  const navigate = useNavigate();
  const { login, loginTwoFactor, user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const successMessage = searchParams.get('registered') 
    ? 'Registration successful! Please check your email to verify your account.' 
    : searchParams.get('verified') 
    ? 'Email verified successfully! You can now sign in.' 
    : '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(successMessage);
  const [isLoading, setIsLoading] = useState(false);
  
  const [requires2FA, setRequires2FA] = useState(false);
  const [isMagicLinkMode, setIsMagicLinkMode] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
      const data = await login(email, password);
      if (data.requiresTwoFactor) {
        setRequires2FA(true);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FALogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await loginTwoFactor(email, token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMagicLink = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await api.requestMagicLink(email);
      setSuccess('Magic link sent! Please check your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    if (requires2FA) {
      return (
        <form className="space-y-6" onSubmit={handle2FALogin}>
          <Input
            label="6-digit Auth Code"
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456"
          />
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Verify Code
          </Button>
          <div className="text-center text-sm">
            <button type="button" onClick={() => setRequires2FA(false)} className="text-indigo-600 hover:text-indigo-500">
              Back to login
            </button>
          </div>
        </form>
      );
    }

    if (isMagicLinkMode) {
      return (
        <form className="space-y-6" onSubmit={handleSendMagicLink}>
          <Input
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Send Magic Link
          </Button>
          <div className="text-center text-sm">
            <button type="button" onClick={() => setIsMagicLinkMode(false)} className="text-indigo-600 hover:text-indigo-500">
              Sign in with password instead
            </button>
          </div>
        </form>
      );
    }

    return (
      <form className="space-y-6" onSubmit={handleLogin}>
        <Input
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        
        <div>
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Forgot your password?
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign in
        </Button>
        
        <div className="text-center text-sm">
          <button type="button" onClick={() => setIsMagicLinkMode(true)} className="text-indigo-600 hover:text-indigo-500">
            Email me a magic link
          </button>
        </div>
      </form>
    );
  };

  return (
    <AuthLayout 
      title={requires2FA ? "Two-Factor Authentication" : "Sign in to OwlSync"}
      subtitle={
        !requires2FA && (
          <>
            Or <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">create a new account</Link>
          </>
        )
      }
    >
      {success && !error && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {renderForm()}

      {!requires2FA && (
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="w-full flex justify-center" 
              type="button"
              onClick={() => window.location.href = 'http://localhost:4000/api/auth/oauth/google'}
            >
              Google
            </Button>
            <Button 
              variant="outline" 
              className="w-full flex justify-center" 
              type="button"
              onClick={() => window.location.href = 'http://localhost:4000/api/auth/oauth/github'}
            >
              GitHub
            </Button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};
