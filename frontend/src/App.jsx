import React, { useState, useEffect } from 'react';
import { getCurrentUser, clearAuthSession } from './api';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import ClassroomPage from './pages/ClassroomPage';
import ClassDetailPage from './pages/ClassDetailPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
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
    setSelectedClassId(null);
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setSelectedClassId(null);
  };

  const handleNavigateHome = () => {
    setSelectedClassId(null);
  };

  // If not logged in, show Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentUser={currentUser}
        onNavigateHome={handleNavigateHome}
        onLogout={handleLogout}
      />
      <main style={{ flexGrow: 1 }}>
        {selectedClassId ? (
          <ClassDetailPage
            classId={selectedClassId}
            user={currentUser}
            onBack={() => setSelectedClassId(null)}
          />
        ) : (
          <ClassroomPage
            user={currentUser}
            onSelectClass={(id) => setSelectedClassId(id)}
          />
        )}
      </main>
    </div>
  );
}
