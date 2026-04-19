import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import API     from '../../api/axios';
import { History, Search } from 'lucide-react';

export default function AirlineHistory() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [date,    setDate]    = useState('');

  const loadLogs = () => {
    setLoading(true);
    const params = date ? `?date=${date}` : '';
    API.get(`/logs${params}`)
      .then(r => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLogs(); }, []);

  const actionColor = {
    FLIGHT_CREATED:       'badge-blue',
    BAY_ALLOCATED:        'badge-green',
    BAY_REASSIGNED:       'badge-yellow',
    FLIGHT_STATUS_UPDATED:'badge-gray',
    ON_BLOCK_RECORDED:    'badge-green',
    OFF_BLOCK_RECORDED:   'badge-gray',
    PUSHBACK_RECORDED:    'badge-yellow',
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Flight History" />

        <div style={{ marginTop: '24px' }}>
          {/* Filter */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Filter by Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={loadLogs}>
                <Search size={14} /> Search
              </button>
              <button className="btn btn-outline" onClick={() => {
                setDate(''); loadLogs();
              }}>
                Clear
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: '10px', marginBottom: '16px' }}>
              <History size={18} color="#0EA5E9" />
              <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                Activity Log
              </h3>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                Loading history...
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                No history found
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Flight</th>
                      <th>Bay</th>
                      <th>Performed By</th>
                      <th>Role</th>
                      <th>Reason</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td>
                          <span className={`badge ${actionColor[log.action_type] || 'badge-gray'}`}>
                            {log.action_type?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: '600', color: '#0EA5E9' }}>
                          {log.flight_number || '—'}
                        </td>
                        <td>{log.bay_number || '—'}</td>
                        <td>{log.performed_by_name || '—'}</td>
                        <td>
                          <span className="badge badge-blue">{log.role}</span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>
                          {log.reason || '—'}
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>
                          {new Date(log.created_at).toLocaleString()}
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