'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

type UserRank = 'user' | 'moderator' | 'admin' | 'owner';

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  rank?: UserRank;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      if (response.data.success) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = (token: string) => {
    document.cookie = `session_token=${token}; path=/; max-age=${30 * 24 * 60 * 60}`;
    fetchUser();
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
      document.cookie = 'session_token=; path=/; max-age=0';
      document.cookie = 'user_info=; path=/; max-age=0';
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
