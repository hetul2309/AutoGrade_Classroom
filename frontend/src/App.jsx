import React, { useState, useEffect } from 'react';
import { getCurrentUser, clearAuthSession, getProfileApi } from './api';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import ClassroomPage from './pages/ClassroomPage';
import ClassDetailPage from './pages/ClassDetailPage';
import AdminPortalPage from './pages/AdminPortalPage';
import ProfileModal from './components/ProfileModal';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import CompleteProfileModal from './components/CompleteProfileModal';
import Toast from './components/Toast';

export default function App() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [currentView, setCurrentView] = useState(
    getCurrentUser()?.role === 'admin' ? 'admin-portal' : 'classroom'
  );
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [toast, setToast] = useState(null);

  // Theme Management (Default: Light Mode)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('autograde_theme') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('autograde_theme', theme);
    } catch {}
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
  };

  // Modal States
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    const handleLogout = () => {
      clearAuthSession();
      setCurrentUser(null);
      setSelectedClassId(null);
      setCurrentView('classroom');
      setIsProfileModalOpen(false);
      setIsLogoutModalOpen(false);
      setToast({ message: 'You have been logged out successfully.', type: 'success' });
    };
    window.addEventListener('auth-logout', handleLogout);
    return () => window.removeEventListener('auth-logout', handleLogout);
  }, []);

  // Fetch latest profile info on mount if logged in
  useEffect(() => {
    if (currentUser) {
      getProfileApi()
        .then((latest) => {
          if (latest) {
            setCurrentUser((prev) => ({ ...prev, ...latest }));
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLoginSuccess = (data) => {
    const userObj = {
      id: data.user_id,
      name: data.name,
      first_name: data.first_name,
      last_name: data.last_name,
      student_id_str: data.student_id_str,
      email: data.email,
      role: data.role,
      avatar_url: data.avatar_url,
      profile_completed: data.profile_completed,
    };
    setCurrentUser(userObj);
    setSelectedClassId(null);
    setCurrentView(userObj.role === 'admin' ? 'admin-portal' : 'classroom');
  };

  const handleConfirmLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setSelectedClassId(null);
    setCurrentView('classroom');
    setIsLogoutModalOpen(false);
    setIsProfileModalOpen(false);
    setToast({ message: 'You have been logged out successfully.', type: 'success' });
  };

  const handleProfileUpdated = (updatedUser) => {
    setCurrentUser((prev) => ({ ...prev, ...updatedUser }));
  };

  const handleNavigateView = (viewName) => {
    setSelectedClassId(null);
    setCurrentView(viewName);
  };

  // If not logged in, show Login Page
  if (!currentUser) {
    return (
      <>
        <LoginPage
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onLoginSuccess={handleLoginSuccess}
        />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </>
    );
  }

  // Check if profile needs initial completion (e.g. newly registered via Google)
  const isProfileIncomplete = currentUser.profile_completed === false;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentUser={currentUser}
        currentView={selectedClassId ? 'classroom' : currentView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onNavigateView={handleNavigateView}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onRequestLogout={() => setIsLogoutModalOpen(true)}
        onNotificationAction={(toastData) => setToast(toastData)}
      />
      <main style={{ flexGrow: 1 }}>
        {selectedClassId ? (
          <ClassDetailPage
            classId={selectedClassId}
            user={currentUser}
            theme={theme}
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

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        theme={theme}
        onSetTheme={handleSetTheme}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* Google Sign-Up Profile Completion Prompt */}
      {isProfileIncomplete && (
        <CompleteProfileModal
          isOpen={true}
          currentUser={currentUser}
          onComplete={handleProfileUpdated}
        />
      )}

      {/* Global Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
