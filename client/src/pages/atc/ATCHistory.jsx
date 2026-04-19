import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import API     from '../../api/axios';
import { History, Search } from 'lucide-react';

export default function ATCHistory() {
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [date,     setDate]     = useState('');
  const [flight,   setFlight]   = useState('');

  const loadMessages = () => {
    setLoading(true);
    API.get('/atc/messages')
      .then(r => {
        let data = r.data;
        if (date) {
          data = data.filter(m =>
            new Date(m.created_at).toLocaleDateString() ===
            new Date(date).toLocaleDateString()
          );
        }
        if (flight) {
          data = data.filter(m =>
            m.flight_number?.toLowerCase().includes(flight.toLowerCase())
          );
        }
        setMessages(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMessages(); }, []);

  const typeColor = {
    LANDING_NOTICE_15MIN: 'badge-yellow',
    BAY_QUERY:            'badge-blue',
    BAY_CONFIRMED:        'badge-green',
    LANDED_CONFIRMATION:  'badge-green',
    DEPARTURE_CLEARANCE:  'badge-gray',
    EMERGENCY_ALERT:      'badge-red',
  };

  const typeIcon = {
    LANDING_NOTICE_15MIN: '📡',
    BAY_QUERY:            '❓',
    BAY_CONFIRMED:        '✅',
    LANDED_CONFIRMATION:  '🛬',
    DEPARTURE_CLEARANCE:  '🛫',
    EMERGENCY_ALERT:      '🚨',
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="ATC History" />

        <div style={{ marginTop: '24px' }}>
          {/* Filters */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px',
                          alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                <label>Filter by Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                <label>Filter by Flight Number</label>
                <input
                  placeholder="e.g. AI202"
                  value={flight}
                  onChange={e => setFlight(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={loadMessages}>
                <Search size={14} /> Search
              </button>
              <button className="btn btn-outline" onClick={() => {
                setDate(''); setFlight(''); loadMessages();
              }}>
                Clear
              </button>
            </div>
          </div>

          {/* Messages Table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: '8px', marginBottom: '16px' }}>
              <History size={18} color="#059669" />
              <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                ATC Communication Log
                <span style={{ fontSize: '12px', color: '#94A3B8',
                               fontWeight: '400', marginLeft: '8px' }}>
                  ({messages.length} records)
                </span>
              </h3>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px',
                            color: '#94A3B8' }}>
                Loading history...
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Flight</th>
                      <th>Bay</th>
                      <th>Sent By</th>
                      <th>Message</th>
                      <th>Acknowledged</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center',
                          padding: '30px', color: '#94A3B8' }}>
                          No ATC messages found
                        </td>
                      </tr>
                    ) : messages.map(m => (
                      <tr key={m.id}>
                        <td>
                          <span className={`badge ${typeColor[m.message_type] || 'badge-gray'}`}>
                            {typeIcon[m.message_type]} {m.message_type?.replace(/_/g,' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: '700', color: '#059669' }}>
                            {m.flight_number}
                          </span>
                        </td>
                        <td>
                          {m.bay_number
                            ? <span className="badge badge-green">{m.bay_number}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>
                          }
                        </td>
                        <td style={{ fontSize: '12px' }}>{m.sent_by_name}</td>
                        <td style={{ fontSize: '12px', color: '#64748B',
                                     maxWidth: '200px' }}>
                          {m.message_body}
                        </td>
                        <td>
                          {m.is_acknowledged
                            ? <span className="badge badge-green">✓ Yes</span>
                            : <span className="badge badge-yellow">Pending</span>
                          }
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}