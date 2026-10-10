import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import { setAuthToken, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext({});

// Platform-safe storage (SecureStore doesn't work on web)
const storage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.deleteItemAsync(key);
  },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await storage.getItem('user');
      const token = await storage.getItem('token');
      if (userData && token) {
        setUser(JSON.parse(userData));
        setAuthToken(token);
      }
    } catch (e) {
      console.error('Failed to load user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData, token) => {
    try {
      await storage.setItem('user', JSON.stringify(userData));
      await storage.setItem('token', token);
      setAuthToken(token);
      setUser(userData);
    } catch (e) {
      // Fallback: just set state even if storage fails
      setAuthToken(token);
      setUser(userData);
    }
  };

  const logout = async () => {
    try {
      await storage.removeItem('user');
      await storage.removeItem('token');
    } catch (e) {
      // ignore storage errors
    }
    setAuthToken(null);
    setUser(null);
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
