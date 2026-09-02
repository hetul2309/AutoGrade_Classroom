import React, { useState, useEffect } from 'react';
import { getCurrentUser, clearAuthSession } from './api';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import ClassroomPage from './pages/ClassroomPage';
import ClassDetailPage from './pages/ClassDetailPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [activeView, setActiveView] = useState(
    getCurrentUser()?.role === 'admin' ? 'admin' : 'student'
  );
  const [selectedClassId, setSelectedClassId] = useState(null);

  useEffect(() => {
    const handleLogout = () => {
      clearAuthSession();
      setCurrentUser(null);
      setSelectedClassId(null);
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
    setSelectedClassId(null);
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setSelectedClassId(null);
  };

  const handleToggleView = () => {
    setActiveView((prev) => (prev === 'admin' ? 'student' : 'admin'));
  };

  const handleNavigateHome = () => {
    setSelectedClassId(null);
  };

  // If not logged in, show Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Active user perspective based on activeView
  const effectiveUser = {
    ...currentUser,
    role: activeView,
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentUser={currentUser}
        activeView={activeView}
        onToggleView={handleToggleView}
        onNavigateHome={handleNavigateHome}
        onLogout={handleLogout}
      />
      <main style={{ flexGrow: 1 }}>
        {selectedClassId ? (
          <ClassDetailPage
            classId={selectedClassId}
            user={effectiveUser}
            onBack={() => setSelectedClassId(null)}
          />
        ) : (
          <ClassroomPage
            user={effectiveUser}
            onSelectClass={(id) => setSelectedClassId(id)}
          />
        )}
      </main>
    </div>
  );
}
