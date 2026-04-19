import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import { useSocket } from '../../context/SocketContext';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  Radio, PlaneLanding, PlaneTakeoff,
  CheckCircle, AlertTriangle, RefreshCw, Send
} from 'lucide-react';

const statusColor = {
  SCHEDULED:    'badge-blue',
  EN_ROUTE:     'badge-blue',
  LANDING_SOON: 'badge-yellow',
  LANDED:       'badge-green',
  ON_BLOCK:     'badge-green',
  PUSHBACK:     'badge-yellow',
  OFF_BLOCK:    'badge-yellow',
  DEPARTED:     'badge-gray',
  DELAYED:      'badge-red',
  CANCELLED:    'badge-red',
};

export default function ATCDashboard() {
  const socket = useSocket();
  const [flights,  setFlights]  = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // Landing notice modal
  const [showModal,  setShowModal]  = useState(false);
  const [selFlight,  setSelFlight]  = useState(null);
  const [msgBody,    setMsgBody]    = useState('');
  const [sending,    setSending]    = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, mRes] = await Promise.all([
        API.get('/atc/flights'),
        API.get('/atc/messages'),
      ]);
      setFlights(fRes.data);
      setMessages(mRes.data);
    } catch {
      toast.error('Failed to load ATC data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('aocc:bay_assigned', (data) => {
      toast.success(
        `✅ AOCC assigned Bay ${data.bay?.bay_number} for flight`,
        { duration: 6000 }
      );
      loadData();
    });
    socket.on('flight:status_update', loadData);
    return () => {
      socket.off('aocc:bay_assigned');
      socket.off('flight:status_update');
    };
  }, [socket]);

  // Send landing notice
  const openLandingNotice = (flight) => {
    setSelFlight(flight);
    setMsgBody(`Flight ${flight.flight_number} is approaching MAA. ETA 15 minutes. Please confirm bay assignment.`);
    setShowModal(true);
  };

  const sendLandingNotice = async () => {
    if (!selFlight) return;
    setSending(true);
    try {
      const res = await API.post('/atc/landing-notice', {
        flight_id:    selFlight.id,
        message_body: msgBody,
      });
      if (res.data.bay_assigned) {
        toast.success(
          `✅ Bay ${res.data.bay_number} already assigned for ${selFlight.flight_number}`,
          { duration: 6000 }
        );
      } else {
        toast(`📡 Landing notice sent to AOCC. Awaiting bay assignment.`,
          { duration: 6000 });
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send notice');
    } finally {
      setSending(false);
    }
  };

  // Confirm landed
  const confirmLanded = async (flight) => {
    try {
      await API.post('/atc/landed', {
        flight_id: flight.id,
        notes: `Flight ${flight.flight_number} has landed successfully at MAA.`
      });
      toast.success(`✅ ${flight.flight_number} landed confirmed`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm');
    }
  };

  // Stats
  const enRoute     = flights.filter(f => f.status === 'EN_ROUTE').length;
  const landingSoon = flights.filter(f => f.status === 'LANDING_SOON').length;
  const landed      = flights.filter(f => f.status === 'LANDED').length;
  const departed    = flights.filter(f => f.status === 'DEPARTED').length;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="ATC — Air Traffic Control" />

        {/* Stats */}
        <div className="stats-row" style={{ marginTop: '24px' }}>
          {[
            { label: 'En Route',     value: enRoute,     color: '#0EA5E9', icon: <PlaneLanding  size={20}/> },
            { label: 'Landing Soon', value: landingSoon, color: '#F59E0B', icon: <AlertTriangle  size={20}/> },
            { label: 'Landed',       value: landed,      color: '#10B981', icon: <CheckCircle   size={20}/> },
            { label: 'Departed',     value: departed,    color: '#64748B', icon: <PlaneTakeoff  size={20}/> },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon"
                style={{ background: s.color + '20', color: s.color }}>
                {s.icon}
              </div>
              <div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' }}>

          {/* Flights Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={18} color="#059669" />
                <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                  Active Flight Queue
                </h3>
              </div>
              <button className="btn btn-outline btn-sm" onClick={loadData}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                Loading flights...
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Flight</th>
                      <th>Airline</th>
                      <th>Aircraft</th>
                      <th>Route</th>
                      <th>Scheduled Arrival</th>
                      <th>Bay</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flights.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center',
                          padding: '30px', color: '#94A3B8' }}>
                          No active flights
                        </td>
                      </tr>
                    ) : flights.map(f => (
                      <tr key={f.id}>
                        <td>
                          <span style={{ fontWeight: '700', color: '#059669' }}>
                            {f.flight_number}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px' }}>{f.airline_name}</td>
                        <td>
                          <div style={{ fontWeight: '600', fontSize: '12px' }}>
                            {f.aircraft_type}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {f.icao_size_code}
                          </div>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <strong>{f.origin}</strong>
                          {' → '}
                          <strong>{f.destination}</strong>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {f.scheduled_arrival
                            ? new Date(f.scheduled_arrival).toLocaleString()
                            : '—'}
                        </td>
                        <td>
                          {f.bay_number
                            ? <span className="badge badge-green">{f.bay_number}</span>
                            : <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                                Pending
                              </span>
                          }
                        </td>
                        <td>
                          <span className={`badge ${statusColor[f.status] || 'badge-gray'}`}>
                            {f.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            {['SCHEDULED','EN_ROUTE'].includes(f.status) && (
                              <button
                                className="btn btn-warning btn-sm"
                                onClick={() => openLandingNotice(f)}
                                title="Send 15-min landing notice to AOCC"
                              >
                                15 Min
                              </button>
                            )}
                            {f.status === 'LANDING_SOON' && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => confirmLanded(f)}
                                title="Confirm aircraft has landed"
                              >
                                Landed ✓
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Panel — ATC Message Log */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center',
                            gap: '8px', marginBottom: '16px' }}>
                <Radio size={16} color="#059669" />
                <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                  ATC Message Log
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px',
                            maxHeight: '500px', overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px',
                                color: '#94A3B8', fontSize: '13px' }}>
                    No messages yet
                  </div>
                ) : messages.slice(0, 20).map(m => (
                  <div key={m.id} style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '10px', padding: '12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontWeight: '700', color: '#059669',
                                     fontSize: '13px' }}>
                        ✈️ {m.flight_number}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(m.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className={`badge ${
                      m.message_type === 'LANDING_NOTICE_15MIN' ? 'badge-yellow'
                      : m.message_type === 'LANDED_CONFIRMATION' ? 'badge-green'
                      : 'badge-blue'
                    }`} style={{ marginBottom: '6px', display: 'inline-block' }}>
                      {m.message_type?.replace(/_/g, ' ')}
                    </span>
                    <p style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                      {m.message_body}
                    </p>
                    {m.bay_number && (
                      <div style={{ marginTop: '6px' }}>
                        <span className="badge badge-green">
                          Bay: {m.bay_number}
                        </span>
                      </div>
                    )}
                    {m.is_acknowledged && (
                      <div style={{ marginTop: '6px', fontSize: '11px',
                                    color: '#10B981', fontWeight: '600' }}>
                        ✓ Acknowledged by AOCC
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Landing Notice Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">
                  Send Landing Notice — {selFlight?.flight_number}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none',
                           cursor: 'pointer', color: '#94A3B8' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  background: '#F0FDF4', borderRadius: '8px',
                  padding: '10px 12px', fontSize: '13px', color: '#065F46'
                }}>
                  <CheckCircle size={14}
                    style={{ display: 'inline', marginRight: '6px' }} />
                  This will notify AOCC that{' '}
                  <strong>{selFlight?.flight_number}</strong>{' '}
                  is landing in 15 minutes.
                  {selFlight?.bay_number && (
                    <span> Bay <strong>{selFlight.bay_number}</strong> is pre-assigned.</span>
                  )}
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                  background: '#F8FAFC', borderRadius: '8px', padding: '12px',
                  fontSize: '13px'
                }}>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Aircraft:</span>
                    <strong style={{ marginLeft: '6px' }}>
                      {selFlight?.aircraft_type}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Size:</span>
                    <strong style={{ marginLeft: '6px' }}>
                      ICAO-{selFlight?.icao_size_code}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>From:</span>
                    <strong style={{ marginLeft: '6px' }}>{selFlight?.origin}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Terminal:</span>
                    <strong style={{ marginLeft: '6px' }}>{selFlight?.terminal}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label>Message to AOCC</label>
                  <textarea
                    rows={3}
                    value={msgBody}
                    onChange={e => setMsgBody(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={sendLandingNotice}
                    disabled={sending}
                  >
                    <Send size={14} />
                    {sending ? 'Sending...' : 'Send to AOCC'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}