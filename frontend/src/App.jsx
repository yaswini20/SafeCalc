import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Journey from './pages/Journey';
import Contacts from './pages/Contacts';
import Geofences from './pages/Geofences';
import History from './pages/History';
import Profile from './pages/Profile';
import './App.css';

function Protected({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="app-loader"><div className="loader-ring"/><span>Loading Safe Calc…</span></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="app-loader"><div className="loader-ring"/></div>;
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/journey" element={<Protected><Journey /></Protected>} />
            <Route path="/contacts" element={<Protected><Contacts /></Protected>} />
            <Route path="/geofences" element={<Protected><Geofences /></Protected>} />
            <Route path="/history" element={<Protected><History /></Protected>} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
