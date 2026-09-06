import React, { useState, useEffect } from 'react';
import { getCurrentUser, clearAuthSession } from './api';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import ClassroomPage from './pages/ClassroomPage';
import ClassDetailPage from './pages/ClassDetailPage';
import AdminPortalPage from './pages/AdminPortalPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [currentView, setCurrentView] = useState(
    getCurrentUser()?.role === 'admin' ? 'admin-portal' : 'classroom'
  );
  const [selectedClassId, setSelectedClassId] = useState(null);

  useEffect(() => {
    const handleLogout = () => {
      clearAuthSession();
      setCurrentUser(null);
      setSelectedClassId(null);
      setCurrentView('classroom');
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
    setCurrentView(userObj.role === 'admin' ? 'admin-portal' : 'classroom');
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setSelectedClassId(null);
    setCurrentView('classroom');
  };

  const handleNavigateView = (viewName) => {
    setSelectedClassId(null);
    setCurrentView(viewName);
  };

  // If not logged in, show Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentUser={currentUser}
        currentView={selectedClassId ? 'classroom' : currentView}
        onNavigateView={handleNavigateView}
        onLogout={handleLogout}
      />
      <main style={{ flexGrow: 1 }}>
        {selectedClassId ? (
          <ClassDetailPage
            classId={selectedClassId}
            user={currentUser}
            onBack={() => setSelectedClassId(null)}
          />
        ) : currentView === 'admin-portal' && currentUser.role === 'admin' ? (
          <AdminPortalPage
            currentUser={currentUser}
            onSwitchToCourses={() => {
              setSelectedClassId(null);
              setCurrentView('classroom');
            }}
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

