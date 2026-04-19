import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import API     from '../../api/axios';
import { History, Search } from 'lucide-react';

export default function AOCCHistory() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [date,    setDate]    = useState('');
  const [action,  setAction]  = useState('');

  const loadLogs = () => {
    setLoading(true);
    let url = '/logs?';
    if (date)   url += `date=${date}&`;
    if (action) url += `action_type=${action}`;
    API.get(url)
      .then(r => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLogs(); }, []);

  const actionColor = {
    FLIGHT_CREATED:        'badge-blue',
    BAY_ALLOCATED:         'badge-green',
    BAY_REASSIGNED:        'badge-yellow',
    BAY_STATUS_UPDATED:    'badge-gray',
    FLIGHT_STATUS_UPDATED: 'badge-gray',
    ON_BLOCK_RECORDED:     'badge-green',
    OFF_BLOCK_RECORDED:    'badge-gray',
    PUSHBACK_RECORDED:     'badge-yellow',
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Full System History" />

        <div style={{ marginTop: '24px' }}>
          {/* Filters */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Filter by Date</label>
                <input type="date" value={date}
                  onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Filter by Action</label>
                <input placeholder="e.g. BAY_ALLOCATED" value={action}
                  onChange={e => setAction(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={loadLogs}>
                <Search size={14} /> Search
              </button>
              <button className="btn btn-outline" onClick={() => {
                setDate(''); setAction(''); loadLogs();
              }}>
                Clear
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: '8px', marginBottom: '16px' }}>
              <History size={18} color="#7C3AED" />
              <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                System Audit Log
                <span style={{ fontSize: '12px', color: '#94A3B8',
                               fontWeight: '400', marginLeft: '8px' }}>
                  ({logs.length} records)
                </span>
              </h3>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                Loading logs...
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
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center',
                          padding: '30px', color: '#94A3B8' }}>
                          No logs found
                        </td>
                      </tr>
                    ) : logs.map(log => (
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
                        <td style={{ fontSize: '12px', color: '#64748B',
                                     maxWidth: '180px' }}>
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