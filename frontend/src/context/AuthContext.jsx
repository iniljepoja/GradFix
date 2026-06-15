import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { setAccessToken, tokenStore } from '../api/client.js';
import * as authApi from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // On first load, restore the session from the stored refresh token.
  useEffect(() => {
    let active = true;
    (async () => {
      const stored = tokenStore.getRefresh();
      if (!stored) { setInitializing(false); return; }
      try {
        const { accessToken, refreshToken } = await authApi.refresh(stored);
        setAccessToken(accessToken);
        tokenStore.setRefresh(refreshToken);
        const profile = await authApi.me();
        if (active) setUser(profile);
      } catch {
        tokenStore.clear();
        setAccessToken(null);
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    setAccessToken(data.accessToken);
    tokenStore.setRefresh(data.refreshToken);
    const profile = await authApi.me();
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(tokenStore.getRefresh()); } catch { /* ignore */ }
    tokenStore.clear();
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.me();
    setUser(profile);
    return profile;
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
