import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
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
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const loginTwoFactor = async (email, token) => {
    const data = await api.loginTwoFactor(email, token);
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const register = async (email, password, name) => {
    return await api.register(email, password, name);
  };

  const logout = async () => {
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
