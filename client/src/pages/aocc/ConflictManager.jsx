import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import API     from '../../api/axios';
import toast   from 'react-hot-toast';
import { GitBranch, Search, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ConflictManager() {
  const [allocations, setAllocations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [bayFilter,   setBayFilter]   = useState('');
  const [dateFilter,  setDateFilter]  = useState('');

  const loadAllocations = () => {
    setLoading(true);
    let url = '/allocations?status=ACTIVE';
    if (dateFilter) url += `&date=${dateFilter}`;
    if (bayFilter)  url += `&bay_id=${bayFilter}`;

    API.get(url)
      .then(r => setAllocations(r.data))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAllocations(); }, []);

  // Detect overlapping allocations for same bay
  const conflicts = allocations.filter(a => {
    return allocations.some(b => {
      if (a.id === b.id || a.bay_id !== b.bay_id) return false;
      const aArr = new Date(a.scheduled_arrival);
      const aDep = new Date(a.scheduled_departure);
      const bArr = new Date(b.scheduled_arrival);
      const bDep = new Date(b.scheduled_departure);
      return aArr < bDep && aDep > bArr;
    });
  });

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Conflict Manager" />

        <div style={{ marginTop: '24px' }}>

          {/* Conflict Alert */}
          {conflicts.length > 0 && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '12px', padding: '16px', marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center',
                            gap: '8px', marginBottom: '8px' }}>
                <AlertTriangle size={20} color="#EF4444" />
                <h4 style={{ fontWeight: '700', color: '#991B1B' }}>
                  {conflicts.length} Conflict(s) Detected!
                </h4>
              </div>
              <p style={{ fontSize: '13px', color: '#7F1D1D' }}>
                The following allocations have overlapping time slots on the same bay.
                Please reassign immediately.
              </p>
            </div>
          )}

          {conflicts.length === 0 && !loading && (
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: '12px', padding: '16px', marginBottom: '20px',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <CheckCircle size={20} color="#10B981" />
              <p style={{ fontSize: '13px', color: '#065F46', fontWeight: '600' }}>
                No conflicts detected. All bay allocations are clear.
              </p>
            </div>
          )}

          {/* Filters */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Filter by Date</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={loadAllocations}>
                <Search size={14} /> Search
              </button>
              <button className="btn btn-outline" onClick={() => {
                setBayFilter(''); setDateFilter('');
                loadAllocations();
              }}>
                Clear
              </button>
            </div>
          </div>

          {/* Allocations Table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: '8px', marginBottom: '16px' }}>
              <GitBranch size={18} color="#7C3AED" />
              <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                Active Bay Allocations
              </h3>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Flight</th>
                    <th>Airline</th>
                    <th>Bay</th>
                    <th>Terminal</th>
                    <th>Scheduled Arrival</th>
                    <th>Scheduled Departure</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Conflict</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center',
                        padding: '30px', color: '#94A3B8' }}>
                        Loading...
                      </td>
                    </tr>
                  ) : allocations.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center',
                        padding: '30px', color: '#94A3B8' }}>
                        No active allocations found
                      </td>
                    </tr>
                  ) : allocations.map(a => {
                    const isConflict = conflicts.some(c => c.id === a.id);
                    return (
                      <tr key={a.id} style={{
                        background: isConflict ? '#FFF5F5' : 'white'
                      }}>
                        <td>
                          <span style={{ fontWeight: '700', color: '#0EA5E9' }}>
                            {a.flight_number}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px' }}>{a.airline_name}</td>
                        <td>
                          <span className="badge badge-blue">{a.bay_number}</span>
                        </td>
                        <td>
                          <span className="badge badge-gray">{a.terminal}</span>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {new Date(a.scheduled_arrival).toLocaleString()}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {new Date(a.scheduled_departure).toLocaleString()}
                        </td>
                        <td>
                          <span className={`badge ${
                            a.allocation_type === 'EMERGENCY'
                              ? 'badge-red'
                              : a.allocation_type === 'MANUAL'
                              ? 'badge-yellow'
                              : 'badge-green'
                          }`}>
                            {a.allocation_type}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-green">{a.status}</span>
                        </td>
                        <td>
                          {isConflict
                            ? <span className="badge badge-red">
                                ⚠ CONFLICT
                              </span>
                            : <span className="badge badge-green">
                                ✓ Clear
                              </span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}