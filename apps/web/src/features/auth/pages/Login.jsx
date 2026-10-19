import React, { useState } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useAuth } from '../../../providers/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';
import { api, API_URL } from '../../../services/api';

export const Login = () => {
  const navigate = useNavigate();
  const { login, loginTwoFactor, register, checkAuth, user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const successMessage = searchParams.get('registered') 
    ? 'Registration successful! Please check your email to verify your account.' 
    : searchParams.get('verified') 
    ? 'Email verified successfully! You can now sign in.' 
    : '';
  const callbackError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState(callbackError || '');
  const [success, setSuccess] = useState(successMessage);
  const [isLoading, setIsLoading] = useState(false);
  
  const [requires2FA, setRequires2FA] = useState(false);
  const [isMagicLinkMode, setIsMagicLinkMode] = useState(false);

  const handleOAuth = async (provider) => {
    setError('');
    if (window.electronAPI?.startOAuth) {
      try {
        setIsLoading(true);
        const result = await window.electronAPI.startOAuth(provider);
        if (result.success && result.token) {
          localStorage.setItem('owlsync_token', result.token);
          if (result.refreshToken) {
            localStorage.setItem('owlsync_refresh_token', result.refreshToken);
          }
          await checkAuth();
          navigate('/dashboard');
        } else if (result.error) {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message || 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    } else {
      window.location.href = `${API_URL}/auth/oauth/${provider}`;
    }
  };

  const handleQuickDemoLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const demoEmail = `guest_${Math.floor(Date.now() / 1000)}@owlsync.dev`;
      const demoPassword = 'DemoPassword123!';
      try {
        await register(demoEmail, demoPassword, 'Guest Developer');
      } catch (regErr) {
        // Fallback if user already created
      }
      await login(demoEmail, demoPassword);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to start guest session: ' + (err.message || 'Please sign in or register'));
    } finally {
      setIsLoading(false);
    }
  };

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
              isLoading={isLoading}
              onClick={() => handleOAuth('google')}
            >
              Google
            </Button>
            <Button 
              variant="outline" 
              className="w-full flex justify-center" 
              type="button"
              isLoading={isLoading}
              onClick={() => handleOAuth('github')}
            >
              GitHub
            </Button>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100">
            <Button
              variant="secondary"
              className="w-full flex justify-center text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300"
              type="button"
              isLoading={isLoading}
              onClick={handleQuickDemoLogin}
            >
              ⚡ Explore with 1-Click Guest Session
            </Button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};
