import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  isTestUser?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  skipLogin: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  toggleSkipLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [skipLogin, setSkipLogin] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    setIsLoading(true);
    try {
      // Default to authenticated local user
      setIsAuthenticated(true);
      setUser({
        id: 0,
        email: 'local-user@app',
        name: 'Local User',
        isTestUser: true
      });
      setSkipLogin(true);
    } catch (error) {
      console.error('[AuthContext] Init failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSkipLogin = async () => {
    const newValue = !skipLogin;
    await AsyncStorage.setItem('settings_skip_login', String(newValue));
    setSkipLogin(newValue);

    if (newValue) {
      setIsAuthenticated(true);
      setUser({
        id: 0,
        email: 'local-user@app',
        name: 'Local User',
        isTestUser: true
      });
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
  };

  const refreshAuth = async () => {
    await initAuth();
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      isLoading,
      skipLogin,
      logout,
      refreshAuth,
      toggleSkipLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
