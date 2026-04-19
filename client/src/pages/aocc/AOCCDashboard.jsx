import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import { useSocket } from '../../context/SocketContext';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  Plane, LayoutGrid, AlertTriangle,
  CheckCircle, Clock, Radio,
  PlaneLanding, PlaneTakeoff, RefreshCw
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

export default function AOCCDashboard() {
  const socket = useSocket();
  const [flights,     setFlights]     = useState([]);
  const [bays,        setBays]        = useState([]);
  const [atcMsgs,     setAtcMsgs]     = useState([]);
  const [delayAlerts, setDelayAlerts] = useState([]);
  const [loading,     setLoading]     = useState(true);

  const loadData = async () => {
    try {
      const [fRes, bRes, aRes] = await Promise.all([
        API.get('/flights'),
        API.get('/bays'),
        API.get('/atc/messages'),
      ]);
      setFlights(fRes.data);
      setBays(bRes.data);
      setAtcMsgs(aRes.data.filter(m => !m.is_acknowledged));
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('flight:new',          loadData);
    socket.on('flight:status_update',loadData);
    socket.on('flight:on_block',     loadData);
    socket.on('flight:off_block',    loadData);
    socket.on('bay:status_update',   loadData);
    socket.on('aocc:bay_assigned',   loadData);

    socket.on('atc:landing_notice', (data) => {
      toast(`✈️ Landing Notice: Flight ${data.flight_id} in 15 min`, {
        icon: '📡', duration: 8000,
      });
      loadData();
    });

    socket.on('aocc:delay_alert', (data) => {
      setDelayAlerts(prev => [data, ...prev.slice(0, 4)]);
      toast.error(`⚠️ Delay: ${data.message}`, { duration: 8000 });
    });

    return () => {
      socket.off('flight:new');
      socket.off('flight:status_update');
      socket.off('flight:on_block');
      socket.off('flight:off_block');
      socket.off('bay:status_update');
      socket.off('aocc:bay_assigned');
      socket.off('atc:landing_notice');
      socket.off('aocc:delay_alert');
    };
  }, [socket]);

  // Stats
  const totalFlights  = flights.length;
  const activeFlights = flights.filter(f =>
    ['EN_ROUTE','LANDING_SOON','LANDED','ON_BLOCK','PUSHBACK'].includes(f.status)
  ).length;
  const availableBays = bays.filter(b => b.status === 'AVAILABLE').length;
  const occupiedBays  = bays.filter(b => b.status === 'OCCUPIED').length;
  const unackAtc      = atcMsgs.length;
  const delayed       = flights.filter(f => f.status === 'DELAYED').length;

  // Auto allocate
  const autoAllocate = async (flightId, flightNumber) => {
    try {
      await API.post('/allocations/auto', { flight_id: flightId });
      toast.success(`Bay allocated for ${flightNumber}`);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Allocation failed';
      toast.error(msg);
    }
  };

  // Acknowledge ATC message
  const acknowledgeAtc = async (id) => {
    try {
      await API.patch(`/atc/messages/${id}/acknowledge`);
      setAtcMsgs(prev => prev.filter(m => m.id !== id));
      toast.success('ATC message acknowledged');
    } catch {
      toast.error('Failed to acknowledge');
    }
  };

  if (loading) return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#94A3B8'
      }}>
        Loading AOCC Dashboard...
      </div>
    </div>
  );

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="AOCC — Operations Control Center" />

        {/* Stats */}
        <div className="stats-row" style={{ marginTop: '24px' }}>
          {[
            { label: 'Total Flights',   value: totalFlights,  icon: <Plane       size={20} />, color: '#0EA5E9' },
            { label: 'Active Flights',  value: activeFlights, icon: <PlaneLanding size={20}/>, color: '#10B981' },
            { label: 'Available Bays',  value: availableBays, icon: <CheckCircle  size={20}/>, color: '#10B981' },
            { label: 'Occupied Bays',   value: occupiedBays,  icon: <LayoutGrid   size={20}/>, color: '#0EA5E9' },
            { label: 'ATC Alerts',      value: unackAtc,      icon: <Radio        size={20}/>, color: '#7C3AED' },
            { label: 'Delayed',         value: delayed,       icon: <AlertTriangle size={20}/>,color: '#EF4444' },
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>

          {/* Left — Flights Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Delay Alerts */}
            {delayAlerts.length > 0 && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: '12px', padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center',
                              gap: '8px', marginBottom: '12px' }}>
                  <AlertTriangle size={18} color="#EF4444" />
                  <h4 style={{ fontWeight: '700', color: '#991B1B' }}>
                    Active Delay Alerts
                  </h4>
                </div>
                {delayAlerts.map((a, i) => (
                  <div key={i} style={{
                    background: 'white', borderRadius: '8px',
                    padding: '10px 12px', marginBottom: '8px',
                    fontSize: '13px', color: '#7F1D1D',
                    border: '1px solid #FECACA'
                  }}>
                    ✈️ <strong>{a.flight_number}</strong> — {a.message}
                  </div>
                ))}
              </div>
            )}

            {/* Flights Table */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                  All Flights
                </h3>
                <button className="btn btn-outline btn-sm" onClick={loadData}>
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Flight</th>
                      <th>Airline</th>
                      <th>Aircraft</th>
                      <th>Route</th>
                      <th>Terminal</th>
                      <th>Bay</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flights.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{
                          textAlign: 'center', padding: '30px',
                          color: '#94A3B8'
                        }}>
                          No flights in the system
                        </td>
                      </tr>
                    ) : flights.map(f => (
                      <tr key={f.id}>
                        <td>
                          <span style={{ fontWeight: '700', color: '#0EA5E9' }}>
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
                          <strong>{f.origin}</strong> → <strong>{f.destination}</strong>
                        </td>
                        <td>
                          <span className="badge badge-blue">{f.terminal}</span>
                        </td>
                        <td>
                          {f.bay_number
                            ? <span className="badge badge-green">{f.bay_number}</span>
                            : <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                                Not assigned
                              </span>
                          }
                        </td>
                        <td>
                          <span className={`badge ${statusColor[f.status] || 'badge-gray'}`}>
                            {f.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          {f.priority !== 'NORMAL'
                            ? <span className="badge badge-red">{f.priority}</span>
                            : <span className="badge badge-gray">NORMAL</span>
                          }
                        </td>
                        <td>
                          {!f.bay_number &&
                           !['DEPARTED','CANCELLED'].includes(f.status) && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => autoAllocate(f.id, f.flight_number)}
                            >
                              Assign Bay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ATC Messages */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center',
                            gap: '8px', marginBottom: '16px' }}>
                <Radio size={18} color="#7C3AED" />
                <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                  ATC Messages
                </h3>
                {unackAtc > 0 && (
                  <span style={{
                    background: '#EF4444', color: 'white',
                    borderRadius: '20px', padding: '1px 8px',
                    fontSize: '11px', fontWeight: '700'
                  }}>
                    {unackAtc}
                  </span>
                )}
              </div>

              {atcMsgs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px',
                              color: '#94A3B8', fontSize: '13px' }}>
                  No pending ATC messages
                </div>
              ) : atcMsgs.map(m => (
                <div key={m.id} style={{
                  background: '#F5F3FF', border: '1px solid #DDD6FE',
                  borderRadius: '10px', padding: '12px',
                  marginBottom: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                                alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '700', color: '#5B21B6',
                                   fontSize: '13px' }}>
                      ✈️ {m.flight_number}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                      {new Date(m.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#4C1D95',
                              marginBottom: '10px' }}>
                    {m.message_body}
                  </p>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => acknowledgeAtc(m.id)}
                  >
                    Acknowledge
                  </button>
                </div>
              ))}
            </div>

            {/* Bay Status Summary */}
            <div className="card">
              <h3 style={{ fontWeight: '700', fontSize: '15px',
                           marginBottom: '16px' }}>
                Bay Status Summary
              </h3>
              {['T1','T3','T4'].map(terminal => {
                const terminalBays = bays.filter(b => b.terminal === terminal);
                const avail = terminalBays.filter(b => b.status === 'AVAILABLE').length;
                const occ   = terminalBays.filter(b => b.status === 'OCCUPIED').length;
                const block = terminalBays.filter(b =>
                  ['BLOCKED','MAINTENANCE'].includes(b.status)
                ).length;

                return (
                  <div key={terminal} style={{
                    background: '#F8FAFC', borderRadius: '10px',
                    padding: '12px 14px', marginBottom: '10px'
                  }}>
                    <div style={{ fontWeight: '700', marginBottom: '8px',
                                  color: '#0F172A' }}>
                      Terminal {terminal}
                      <span style={{ fontSize: '11px', color: '#94A3B8',
                                     marginLeft: '6px' }}>
                        ({terminalBays.length} total)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-green">✓ {avail} Available</span>
                      <span className="badge badge-blue">● {occ} Occupied</span>
                      {block > 0 &&
                        <span className="badge badge-red">✕ {block} Blocked</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Arrivals */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center',
                            gap: '8px', marginBottom: '14px' }}>
                <PlaneLanding size={16} color="#10B981" />
                <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                  Recent Activity
                </h3>
              </div>
              {flights
                .filter(f => ['LANDED','ON_BLOCK','DEPARTED'].includes(f.status))
                .slice(0, 6)
                .map(f => (
                  <div key={f.id} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '8px 0',
                    borderBottom: '1px solid #F1F5F9'
                  }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px',
                                    color: '#0EA5E9' }}>
                        {f.flight_number}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {f.airline_name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${statusColor[f.status]}`}>
                        {f.status?.replace(/_/g, ' ')}
                      </span>
                      {f.bay_number && (
                        <div style={{ fontSize: '11px', color: '#64748B',
                                      marginTop: '3px' }}>
                          Bay {f.bay_number}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {flights.filter(f =>
                ['LANDED','ON_BLOCK','DEPARTED'].includes(f.status)
              ).length === 0 && (
                <div style={{ textAlign: 'center', color: '#94A3B8',
                              fontSize: '13px', padding: '16px' }}>
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}