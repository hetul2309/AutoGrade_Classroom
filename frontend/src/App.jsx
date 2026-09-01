import React, { useState, useEffect } from 'react';
import { getCurrentUser, clearAuthSession } from './api';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());

  useEffect(() => {
    const handleLogout = () => {
      clearAuthSession();
      setCurrentUser(null);
    };
    window.addEventListener('auth-logout', handleLogout);
    return () => window.removeEventListener('auth-logout', handleLogout);
  }, []);

  const handleLoginSuccess = (data) => {
    setCurrentUser({
      id: data.user_id,
      name: data.name,
      email: data.email,
      role: data.role,
    });
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
  };

  // If not logged in, show Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Admin Dashboard View
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentUser={currentUser} onLogout={handleLogout} />
      <main style={{ flexGrow: 1 }}>
        <AdminDashboard />
      </main>
    </div>
  );
}
