import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      // Check if redirected from OAuth with tokens in query params
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const urlRefreshToken = params.get('refreshToken');

      if (urlToken) {
        localStorage.setItem('owlsync_token', urlToken);
        if (urlRefreshToken) {
          localStorage.setItem('owlsync_refresh_token', urlRefreshToken);
        }
        // Remove token query parameters from URL cleanly without page reload
        params.delete('token');
        params.delete('refreshToken');
        const remainingQuery = params.toString() ? `?${params.toString()}` : '';
        const cleanUrl = `${window.location.pathname}${remainingQuery}${window.location.hash}`;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      const data = await api.getMe();
      setUser(data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    if (data.token) {
      localStorage.setItem('owlsync_token', data.token);
    }
    if (data.refreshToken) {
      localStorage.setItem('owlsync_refresh_token', data.refreshToken);
    }
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const loginTwoFactor = async (email, token) => {
    const data = await api.loginTwoFactor(email, token);
    if (data.token) {
      localStorage.setItem('owlsync_token', data.token);
    }
    if (data.refreshToken) {
      localStorage.setItem('owlsync_refresh_token', data.refreshToken);
    }
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const register = async (email, password, name) => {
    return await api.register(email, password, name);
  };

  const logout = async () => {
    try {
      // Import socketService dynamically to avoid circular dependencies if any
      const { socketService } = await import('../services/socket');
      socketService.disconnect();
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem('owlsync_token');
    localStorage.removeItem('owlsync_refresh_token');
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginTwoFactor, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
