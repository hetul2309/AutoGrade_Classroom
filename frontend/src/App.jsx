import React, { useState, useEffect } from 'react';
import { getCurrentUser, clearAuthSession } from './api';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import StudentPortal from './pages/StudentPortal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [activeView, setActiveView] = useState(
    getCurrentUser()?.role === 'admin' ? 'admin' : 'student'
  );

  useEffect(() => {
    const handleLogout = () => {
      clearAuthSession();
      setCurrentUser(null);
    };
    window.addEventListener('auth-logout', handleLogout);
    return () => window.removeEventListener('auth-logout', handleLogout);
  }, []);

  const handleLoginSuccess = (data) => {
    const userObj = {
      id: data.user_id,
      name: data.name,
      email: data.email,
      role: data.role,
    };
    setCurrentUser(userObj);
    setActiveView(data.role === 'admin' ? 'admin' : 'student');
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
  };

  const handleToggleView = () => {
    setActiveView((prev) => (prev === 'admin' ? 'student' : 'admin'));
  };

  // If not logged in, show Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentUser={currentUser}
        activeView={activeView}
        onToggleView={handleToggleView}
        onLogout={handleLogout}
      />
      <main style={{ flexGrow: 1 }}>
        {activeView === 'admin' ? (
          <AdminDashboard />
        ) : (
          <StudentPortal currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}
