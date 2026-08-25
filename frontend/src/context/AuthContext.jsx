import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);
const API = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) { setUser(null); setLoading(false); return; }
      try {
        const res = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!cancelled && json.success) setUser(json.data);
        else if (!cancelled) { localStorage.removeItem('token'); setToken(''); setUser(null); }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, message: json.message || 'Login failed.' };
      localStorage.setItem('token', json.data.token);
      setToken(json.data.token);
      setUser(json.data);
      return { success: true };
    } catch { return { success: false, message: 'Unable to reach the safety server.' }; }
  };

  const register = async (payload) => {
    try {
      const res = await fetch(`${API}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json.success) return { success: false, message: json.message || 'Registration failed.' };
      localStorage.setItem('token', json.data.token);
      setToken(json.data.token);
      setUser(json.data);
      return { success: true };
    } catch { return { success: false, message: 'Unable to reach the safety server.' }; }
  };

  const logout = () => { localStorage.removeItem('token'); setToken(''); setUser(null); };

  const apiRequest = async (path, options = {}) => {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const text = await response.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { success: false, message: text || 'Invalid server response' }; }
    if (response.status === 401) logout();
    return json;
  };

  const updateProfile = async (payload) => {
    const res = await apiRequest('/api/auth/profile', { method: 'PUT', body: JSON.stringify(payload) });
    if (res.success) setUser(res.data);
    return res;
  };

  const changePassword = (oldPassword, newPassword) => apiRequest('/api/auth/change-password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) });
  const deleteAccount = async () => { const res = await apiRequest('/api/auth/delete-account', { method: 'DELETE' }); if (res.success) logout(); return res; };

  const value = useMemo(() => ({ API, token, user, loading, isAuthenticated: !!user, login, register, logout, apiRequest, updateProfile, changePassword, deleteAccount }), [token, user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
