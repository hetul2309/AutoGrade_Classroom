import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    type: 'grade',
    title: 'Assignment Graded',
    message: 'Lab 3: Feature Engineering & Preprocessing graded (95/100).',
    time: '5m ago',
    isRead: false,
    badge: 'Graded',
  },
  {
    id: 'notif-2',
    type: 'submission',
    title: 'Lab 4 Submission Received',
    message: 'Notebook uploaded to Cloudinary cache & queued for AI evaluation.',
    time: '1h ago',
    isRead: false,
    badge: 'AI Ready',
  },
  {
    id: 'notif-3',
    type: 'announcement',
    title: 'New Class Discussion',
    message: 'Prof. Miller posted an announcement regarding Lab 4 worst-case loss.',
    time: '3h ago',
    isRead: true,
  },
];

export default function NotificationBell({ currentUser, onNavigateToItem }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('autograde_notifications');
      return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });

  const bellRef = useRef(null);

  // Save notifications locally
  useEffect(() => {
    try {
      localStorage.setItem('autograde_notifications', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleDeleteNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div style={{ position: 'relative' }} ref={bellRef}>
      <button
        id="nav-notifications-btn"
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: open ? 'rgba(255, 106, 0, 0.15)' : 'var(--bg-card)',
          border: open ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: open ? 'var(--primary)' : 'var(--text-muted)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary)';
          e.currentTarget.style.color = 'var(--primary)';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }
        }}
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              fontSize: '11px',
              fontWeight: '700',
              lineHeight: '1',
              background: 'linear-gradient(135deg, #FF6A00, #FF2D8D)',
              color: '#ffffff',
              borderRadius: '999px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(255, 106, 0, 0.5)',
              border: '1.5px solid var(--bg-surface, #0f172a)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={notifications}
          onClose={() => setOpen(false)}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onDeleteNotification={handleDeleteNotification}
          onSelectNotification={(notif) => {
            setOpen(false);
            if (onNavigateToItem) onNavigateToItem(notif);
          }}
        />
      )}
    </div>
  );
}
