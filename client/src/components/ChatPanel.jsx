import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import API from '../api/axios';

export default function ChatPanel({ toRole, flightId }) {
  const { user }  = useAuth();
  const socket    = useSocket();
  const [messages, setMessages] = useState([]);
  const [body, setBody]         = useState('');
  const [sending, setSending]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    API.get('/messages').then(r => setMessages(r.data)).catch(() => {});
  }, [toRole]);

  useEffect(() => {
    if (!socket) return;
    socket.on('message:new', (msg) => {
      setMessages(prev => [msg, ...prev]);
    });
    return () => socket.off('message:new');
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await API.post('/messages', {
        to_role:   toRole,
        flight_id: flightId || null,
        body:      body.trim(),
        subject:   `Message from ${user.role}`,
      });
      setBody('');
    } catch {
      // handled by interceptor
    } finally {
      setSending(false);
    }
  };

  const displayed = [...messages].reverse();

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {displayed.map((m, i) => {
          const isMine = m.from_user_id === user.id ||
                         m.from_role    === user.role;
          return (
            <div key={m.id || i}>
              {!isMine && (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>
                  {m.from_name || m.from_role}
                </div>
              )}
              <div className={`chat-bubble ${isMine ? 'sent' : 'received'}`}>
                {m.body}
                <div style={{
                  fontSize: '10px', marginTop: '4px',
                  opacity: 0.7, textAlign: 'right'
                }}>
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          placeholder={`Message to ${toRole}...`}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={sendMessage}
          disabled={sending || !body.trim()}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}