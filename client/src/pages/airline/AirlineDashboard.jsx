import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import { useSocket } from '../../context/SocketContext';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  Plane, PlaneTakeoff, PlaneLanding,
  Clock, AlertTriangle, CheckCircle,
  Upload, MessageSquare, Plus
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

export default function AirlineDashboard() {
  const socket = useSocket();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFlights = () => {
    API.get('/flights')
      .then(r => setFlights(r.data))
      .catch(() => toast.error('Failed to load flights'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadFlights(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('flight:status_update', loadFlights);
    socket.on('aocc:bay_assigned',    loadFlights);
    socket.on('aocc:delay_alert', (data) => {
      toast.error(`⚠️ Delay Alert: ${data.message}`, { duration: 6000 });
    });
    return () => {
      socket.off('flight:status_update');
      socket.off('aocc:bay_assigned');
      socket.off('aocc:delay_alert');
    };
  }, [socket]);

  // Stats
  const total     = flights.length;
  const active    = flights.filter(f =>
    ['EN_ROUTE','LANDING_SOON','LANDED','ON_BLOCK','PUSHBACK'].includes(f.status)
  ).length;
  const departed  = flights.filter(f => f.status === 'DEPARTED').length;
  const delayed   = flights.filter(f => f.status === 'DELAYED').length;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Airline Dashboard" />

        {/* Stats */}
        <div className="stats-row" style={{ marginTop: '24px' }}>
          {[
            { label: 'Total Flights',   value: total,    icon: <Plane size={20} />,          color: '#0EA5E9' },
            { label: 'Active Flights',  value: active,   icon: <PlaneLanding size={20} />,   color: '#10B981' },
            { label: 'Departed',        value: departed, icon: <PlaneTakeoff size={20} />,   color: '#64748B' },
            { label: 'Delayed',         value: delayed,  icon: <AlertTriangle size={20} />,  color: '#EF4444' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon" style={{ background: s.color + '20', color: s.color }}>
                {s.icon}
              </div>
              <div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <Link to="/airline/flights/new" className="btn btn-primary">
            <Plus size={15} /> Add New Flight
          </Link>
          <Link to="/airline/schedule-upload" className="btn btn-outline">
            <Upload size={15} /> Upload Schedule
          </Link>
          <Link to="/airline/messages" className="btn btn-outline">
            <MessageSquare size={15} /> Message AOCC
          </Link>
        </div>

        {/* Flights Table */}
        <div className="card">
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '16px'
          }}>
            <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
              My Flights
            </h3>
            <button className="btn btn-outline btn-sm" onClick={loadFlights}>
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
              Loading flights...
            </div>
          ) : flights.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
              <Plane size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p>No flights yet. Add your first flight!</p>
              <Link to="/airline/flights/new" className="btn btn-primary"
                style={{ marginTop: '12px', display: 'inline-flex' }}>
                <Plus size={15} /> Add Flight
              </Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Flight No.</th>
                    <th>Aircraft</th>
                    <th>Route</th>
                    <th>Scheduled Arrival</th>
                    <th>Scheduled Departure</th>
                    <th>Bay</th>
                    <th>Status</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {flights.map(f => (
                    <tr key={f.id}>
                      <td>
                        <span style={{ fontWeight: '700', color: '#0EA5E9' }}>
                          {f.flight_number}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{f.aircraft_type}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                          {f.registration_number}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: '600' }}>{f.origin}</span>
                        {' → '}
                        <span style={{ fontWeight: '600' }}>{f.destination}</span>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {f.scheduled_arrival
                          ? new Date(f.scheduled_arrival).toLocaleString()
                          : '—'}
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {f.scheduled_departure
                          ? new Date(f.scheduled_departure).toLocaleString()
                          : '—'}
                      </td>
                      <td>
                        {f.bay_number
                          ? <span className="badge badge-blue">{f.bay_number}</span>
                          : <span style={{ color: '#94A3B8', fontSize: '12px' }}>Not assigned</span>
                        }
                      </td>
                      <td>
                        <span className={`badge ${statusColor[f.status] || 'badge-gray'}`}>
                          {f.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {f.priority !== 'NORMAL'
                          ? <span className="badge badge-red">{f.priority}</span>
                          : <span className="badge badge-gray">NORMAL</span>
                        }
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
  );
}