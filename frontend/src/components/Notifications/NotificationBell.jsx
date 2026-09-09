import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import {
  getUserNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationApi,
  respondTeacherInvitationApi,
} from '../../api';

export default function NotificationBell({ currentUser, onNavigateToItem, onNotificationAction }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getUserNotificationsApi();
      if (Array.isArray(data)) {
        const formatted = data.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.is_read,
          invitationId: n.invitation_id,
          invitationStatus: n.invitation_status,
          classId: n.class_id,
          className: n.class_name,
          time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
        }));
        setNotifications(formatted);
      }
    } catch (err) {
      console.warn('Failed to fetch user notifications:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // 15s poll
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('notifications-refresh', fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('notifications-refresh', fetchNotifications);
    };
  }, [fetchNotifications]);

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

  const handleMarkAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await markNotificationReadApi(id);
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsReadApi();
    } catch {}
  };

  const handleDeleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNotificationApi(id);
    } catch {}
  };

  const handleRespondInvitation = async (invitationId, action, notif) => {
    try {
      const res = await respondTeacherInvitationApi(invitationId, action);
      setNotifications((prev) =>
        prev.map((n) =>
          (n.invitationId === invitationId || n.id === notif.id)
            ? { ...n, invitationStatus: action === 'accept' ? 'accepted' : 'declined', isRead: true }
            : n
        )
      );
      // Trigger global classes refresh event
      window.dispatchEvent(new CustomEvent('classes-updated', { detail: { classId: notif.classId } }));
      if (onNotificationAction) {
        onNotificationAction({
          type: 'success',
          message: res.message || (action === 'accept' ? 'Accepted invitation!' : 'Invitation declined.'),
        });
      }
    } catch (err) {
      if (onNotificationAction) {
        onNotificationAction({
          type: 'error',
          message: err.message || `Failed to ${action} invitation.`,
        });
      }
    }
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
          onRespondInvitation={handleRespondInvitation}
          onSelectNotification={(notif) => {
            setOpen(false);
            if (onNavigateToItem) onNavigateToItem(notif);
          }}
        />
      )}
    </div>
  );
}
