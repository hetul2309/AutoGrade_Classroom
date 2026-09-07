import React from 'react';
import {
  Bell, CheckCircle2, FileCode2, Sparkles, MessageSquare,
  AlertTriangle, Trash2, Check, X, ShieldAlert, BookOpen
} from 'lucide-react';

function getNotificationIcon(type) {
  const iconProps = { size: 16 };
  switch (type) {
    case 'grade':
    case 'like':
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(255, 45, 141, 0.15)',
          color: '#FF2D8D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Sparkles {...iconProps} />
        </div>
      );
    case 'submission':
    case 'assignment':
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(255, 106, 0, 0.15)',
          color: '#FF6A00',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <FileCode2 {...iconProps} />
        </div>
      );
    case 'alert':
    case 'flag':
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <ShieldAlert {...iconProps} />
        </div>
      );
    case 'announcement':
    case 'comment':
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <MessageSquare {...iconProps} />
        </div>
      );
    default:
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(255, 106, 0, 0.12)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Bell {...iconProps} />
        </div>
      );
  }
}

export default function NotificationDropdown({
  notifications = [],
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onSelectNotification
}) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 10px)',
        width: '360px',
        maxHeight: '480px',
        background: 'var(--dropdown-bg, #131b2e)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.4), 0 0 25px rgba(255, 106, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 60,
        animation: 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} color="var(--primary)" />
          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>
            Notifications
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={onMarkAllAsRead}
              type="button"
              style={{
                background: 'rgba(255, 106, 0, 0.12)',
                color: 'var(--primary)',
                border: 'none',
                borderRadius: '999px',
                padding: '4px 10px',
                fontSize: '0.74rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <Check size={12} />
              <span>Mark all read</span>
            </button>
          )}

          <button
            onClick={onClose}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div
        style={{
          overflowY: 'auto',
          maxHeight: '390px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {notifications.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '0.88rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Bell size={28} style={{ opacity: 0.35 }} />
            <span>No notifications yet</span>
          </div>
        ) : (
          notifications.map((notif, idx) => (
            <div
              key={notif.id || idx}
              onClick={() => {
                if (onSelectNotification) onSelectNotification(notif);
                if (!notif.isRead && onMarkAsRead) onMarkAsRead(notif.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 16px',
                borderBottom:
                  idx !== notifications.length - 1
                    ? '1px solid var(--border-subtle)'
                    : 'none',
                background: notif.isRead
                  ? 'transparent'
                  : 'rgba(255, 106, 0, 0.05)',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-card-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = notif.isRead
                  ? 'transparent'
                  : 'rgba(255, 106, 0, 0.05)';
              }}
            >
              {/* Unread indicator dot */}
              {!notif.isRead && (
                <div
                  style={{
                    position: 'absolute',
                    left: '6px',
                    top: '18px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#FF6A00',
                    boxShadow: '0 0 6px #FF6A00',
                  }}
                />
              )}

              {getNotificationIcon(notif.type)}

              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: notif.isRead ? '500' : '700',
                    color: 'var(--text-main)',
                    lineHeight: '1.3',
                  }}
                >
                  {notif.title || 'Class Notification'}
                </div>

                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    lineHeight: '1.35',
                    wordBreak: 'break-word',
                  }}
                >
                  {notif.message || notif.content}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '6px',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    {notif.time || 'Recently'}
                  </span>

                  {notif.badge && (
                    <span
                      className="badge badge-graded"
                      style={{ fontSize: '0.65rem', padding: '1px 6px' }}
                    >
                      {notif.badge}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete button */}
              {onDeleteNotification && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNotification(notif.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    opacity: 0.6,
                    transition: 'opacity 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.color = 'var(--text-dim)';
                  }}
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
