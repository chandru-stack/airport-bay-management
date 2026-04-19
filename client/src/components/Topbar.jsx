import { useState, useEffect } from 'react';
import { Bell, Wifi, WifiOff, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import API from '../api/axios';

export default function Topbar({ title }) {
  const { user }   = useAuth();
  const socket     = useSocket();
  const [time, setTime]   = useState(new Date());
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [connected, setConnected]   = useState(false);

  // UTC clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Socket connection status
  useEffect(() => {
    if (!socket) return;
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    setConnected(socket.connected);
  }, [socket]);

  // Load notifications
  useEffect(() => {
    API.get('/notifications')
      .then(r => setNotifs(r.data))
      .catch(() => {});
  }, []);

  // Listen for new notifications
  useEffect(() => {
    if (!socket) return;
    socket.on('notification:push', (n) => {
      setNotifs(prev => [n, ...prev]);
    });
  }, [socket]);

  const unread = notifs.filter(n => !n.is_read).length;

  const markRead = async (id) => {
    await API.patch(`/notifications/${id}/read`);
    setNotifs(prev => prev.map(n =>
      n.id === id ? { ...n, is_read: true } : n
    ));
  };

  const roleColors = {
    AIRLINE: '#0EA5E9',
    AOCC:    '#7C3AED',
    ATC:     '#059669',
    APRON:   '#D97706',
  };
  const color = roleColors[user?.role] || '#0EA5E9';

  return (
    <div className="topbar">
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
          {title}
        </h2>
        <p style={{ fontSize: '11px', color: '#94A3B8' }}>
          Chennai International Airport — MAA
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {/* UTC Time */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: '#F1F5F9', padding: '6px 12px',
          borderRadius: '8px',
        }}>
          <Clock size={13} color="#64748B" />
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155', fontFamily: 'monospace' }}>
            {time.toUTCString().slice(17, 25)} UTC
          </span>
        </div>

        {/* Connection status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '12px',
          color: connected ? '#10B981' : '#EF4444',
        }}>
          {connected
            ? <><Wifi size={14} /> Live</>
            : <><WifiOff size={14} /> Offline</>
          }
        </div>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', position: 'relative',
              padding: '6px',
            }}
          >
            <Bell size={20} color="#64748B" />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: '2px', right: '2px',
                background: '#EF4444', color: 'white',
                borderRadius: '50%', width: '16px', height: '16px',
                fontSize: '10px', fontWeight: '700',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showNotifs && (
            <div style={{
              position: 'absolute', right: 0, top: '40px',
              width: '320px', background: 'white',
              border: '1px solid #E2E8F0', borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              zIndex: 999, overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #E2E8F0',
                fontWeight: '700', fontSize: '13px',
              }}>
                Notifications {unread > 0 && (
                  <span style={{
                    background: '#EF4444', color: 'white',
                    borderRadius: '20px', padding: '1px 8px',
                    fontSize: '11px', marginLeft: '6px',
                  }}>{unread}</span>
                )}
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                    No notifications
                  </div>
                ) : notifs.slice(0, 15).map(n => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #F1F5F9',
                      background: n.is_read ? 'white' : '#F0F9FF',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '12px', color: '#0F172A' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Role badge */}
        <span style={{
          background: color + '15', color,
          padding: '5px 12px', borderRadius: '20px',
          fontSize: '12px', fontWeight: '700',
        }}>
          {user?.role}
        </span>
      </div>
    </div>
  );
}