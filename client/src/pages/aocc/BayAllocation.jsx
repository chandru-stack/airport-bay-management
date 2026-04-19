import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import API     from '../../api/axios';
import toast   from 'react-hot-toast';
import {
  Layers, RefreshCw, CheckCircle,
  AlertTriangle, X, Eye
} from 'lucide-react';

export default function BayAllocation() {
  const [flights,     setFlights]     = useState([]);
  const [bays,        setBays]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('UNASSIGNED');

  // Modal state
  const [showModal,   setShowModal]   = useState(false);
  const [selFlight,   setSelFlight]   = useState(null);
  const [modalMode,   setModalMode]   = useState('ASSIGN'); // ASSIGN or REASSIGN
  const [selBayId,    setSelBayId]    = useState('');
  const [reason,      setReason]      = useState('');
  const [saving,      setSaving]      = useState(false);
  const [suggested,   setSuggested]   = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, bRes] = await Promise.all([
        API.get('/flights'),
        API.get('/bays'),
      ]);
      setFlights(fRes.data);
      setBays(bRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Open modal for new assignment
  const openAssignModal = async (flight) => {
    setSelFlight(flight);
    setModalMode('ASSIGN');
    setSelBayId('');
    setReason('');
    setSaving(false);

    // Load suggested compatible bays
    try {
      const res = await API.get(
        `/bays/available/${flight.icao_size_code}/${flight.terminal}?arrival=${flight.scheduled_arrival}&departure=${flight.scheduled_departure}`
      );
      setSuggested(res.data);
    } catch {
      // fallback — show all available bays
      setSuggested(bays.filter(b => b.status === 'AVAILABLE'));
    }
    setShowModal(true);
  };

  // Open modal for reassign
  const openReassignModal = (flight) => {
    setSelFlight(flight);
    setModalMode('REASSIGN');
    setSelBayId('');
    setReason('');
    setSaving(false);
    setSuggested(bays.filter(b =>
      b.status === 'AVAILABLE' && b.id !== flight.bay_id
    ));
    setShowModal(true);
  };

  // Confirm assign selected bay
  const confirmAssign = async () => {
    if (!selBayId) {
      toast.error('Please select a bay');
      return;
    }
    setSaving(true);
    try {
      const res = await API.post('/allocations/manual', {
        flight_id: selFlight.id,
        bay_id:    parseInt(selBayId),
      });
      toast.success(`✅ Bay assigned for ${selFlight.flight_number}`);
      setShowModal(false);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Assignment failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Confirm reassign
  const confirmReassign = async () => {
    if (!selBayId || !reason) {
      toast.error('Select a bay and provide a reason');
      return;
    }
    setSaving(true);
    try {
      await API.post('/allocations/reassign', {
        flight_id:  selFlight.id,
        new_bay_id: parseInt(selBayId),
        reason,
      });
      toast.success(`Bay reassigned for ${selFlight.flight_number}`);
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reassignment failed');
    } finally {
      setSaving(false);
    }
  };

  const unassigned = flights.filter(f =>
    !f.bay_number && !['DEPARTED', 'CANCELLED'].includes(f.status)
  );
  const assigned = flights.filter(f => f.bay_number);
  const displayed = filter === 'UNASSIGNED' ? unassigned : assigned;

  // Compatible bays for reassign modal
  const compatibleBays = modalMode === 'REASSIGN'
    ? bays.filter(b => b.status === 'AVAILABLE')
    : suggested;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Bay Allocation Manager" />

        <div style={{ marginTop: '24px' }}>

          {/* Summary */}
          <div className="stats-row" style={{ marginBottom: '20px' }}>
            {[
              { label: 'Unassigned Flights', value: unassigned.length, color: '#EF4444' },
              { label: 'Assigned Flights',   value: assigned.length,   color: '#10B981' },
              { label: 'Total Bays',         value: bays.length,       color: '#0EA5E9' },
              { label: 'Available Bays',
                value: bays.filter(b => b.status === 'AVAILABLE').length,
                color: '#10B981' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div>
                  <div className="stat-value" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['UNASSIGNED', 'ASSIGNED'].map(f => (
              <button
                key={f}
                className={`btn ${filter === f ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilter(f)}
              >
                {f === 'UNASSIGNED'
                  ? `Unassigned (${unassigned.length})`
                  : `Assigned (${assigned.length})`
                }
              </button>
            ))}
            <button
              className="btn btn-outline btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={loadData}
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Table */}
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Flight</th>
                    <th>Airline</th>
                    <th>Aircraft</th>
                    <th>Size</th>
                    <th>Terminal</th>
                    <th>Arrival</th>
                    <th>Departure</th>
                    <th>Priority</th>
                    <th>Bay</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center',
                        padding: '30px', color: '#94A3B8' }}>
                        Loading...
                      </td>
                    </tr>
                  ) : displayed.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center',
                        padding: '30px', color: '#94A3B8' }}>
                        {filter === 'UNASSIGNED'
                          ? '✅ All flights have been assigned bays!'
                          : 'No assigned flights yet'
                        }
                      </td>
                    </tr>
                  ) : displayed.map(f => (
                    <tr key={f.id}>
                      <td>
                        <span style={{ fontWeight: '700', color: '#0EA5E9' }}>
                          {f.flight_number}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{f.airline_name}</td>
                      <td style={{ fontSize: '12px' }}>{f.aircraft_type}</td>
                      <td>
                        <span className="badge badge-blue">
                          ICAO-{f.icao_size_code}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-gray">{f.terminal}</span>
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
                        {f.priority !== 'NORMAL'
                          ? <span className="badge badge-red">{f.priority}</span>
                          : <span className="badge badge-gray">NORMAL</span>
                        }
                      </td>
                      <td>
                        {f.bay_number
                          ? <span className="badge badge-green">{f.bay_number}</span>
                          : <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                              None
                            </span>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!f.bay_number && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => openAssignModal(f)}
                            >
                              <Eye size={12} /> Select Bay
                            </button>
                          )}
                          {f.bay_number && (
                            <button
                              className="btn btn-warning btn-sm"
                              onClick={() => openReassignModal(f)}
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Assign / Reassign Modal */}
        {showModal && selFlight && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '560px' }}
            >
              <div className="modal-header">
                <h3 className="modal-title">
                  {modalMode === 'ASSIGN' ? '🛫 Assign Bay' : '🔄 Reassign Bay'}
                  {' — '}{selFlight.flight_number}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none',
                           cursor: 'pointer', color: '#94A3B8', fontSize: '18px' }}
                >✕</button>
              </div>

              {/* Flight Summary */}
              <div style={{
                background: '#F0F9FF', borderRadius: '10px',
                padding: '12px 14px', marginBottom: '16px',
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: '8px', fontSize: '12px'
              }}>
                <div>
                  <span style={{ color: '#94A3B8' }}>Aircraft:</span>
                  <strong style={{ marginLeft: '4px' }}>
                    {selFlight.aircraft_type}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#94A3B8' }}>Size:</span>
                  <strong style={{ marginLeft: '4px' }}>
                    ICAO-{selFlight.icao_size_code}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#94A3B8' }}>Terminal:</span>
                  <strong style={{ marginLeft: '4px' }}>
                    {selFlight.terminal}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#94A3B8' }}>Arrival:</span>
                  <strong style={{ marginLeft: '4px' }}>
                    {selFlight.scheduled_arrival
                      ? new Date(selFlight.scheduled_arrival).toLocaleString()
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#94A3B8' }}>Priority:</span>
                  <strong style={{ marginLeft: '4px', color:
                    selFlight.priority !== 'NORMAL' ? '#EF4444' : '#10B981'
                  }}>
                    {selFlight.priority}
                  </strong>
                </div>
                {selFlight.bay_number && (
                  <div>
                    <span style={{ color: '#94A3B8' }}>Current Bay:</span>
                    <strong style={{ marginLeft: '4px', color: '#0EA5E9' }}>
                      {selFlight.bay_number}
                    </strong>
                  </div>
                )}
              </div>

              {/* Available Bays List */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>
                  Select Bay
                  <span style={{ color: '#94A3B8', fontWeight: '400',
                                 marginLeft: '8px' }}>
                    ({compatibleBays.length} available)
                  </span>
                </label>

                {compatibleBays.length === 0 ? (
                  <div style={{
                    background: '#FEF2F2', borderRadius: '8px',
                    padding: '12px', color: '#991B1B', fontSize: '13px'
                  }}>
                    ⚠️ No compatible bays available for this time slot.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '8px', maxHeight: '240px', overflowY: 'auto',
                    padding: '4px'
                  }}>
                    {compatibleBays.map(b => (
                      <div
                        key={b.id}
                        onClick={() => setSelBayId(String(b.id))}
                        style={{
                          border: `2px solid ${
                            selBayId === String(b.id) ? '#0EA5E9' : '#E2E8F0'
                          }`,
                          borderRadius: '10px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          background: selBayId === String(b.id)
                            ? '#E0F2FE' : 'white',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: '700', fontSize: '13px',
                                      color: '#0F172A' }}>
                          {b.bay_number}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B',
                                      marginTop: '2px' }}>
                          {b.bay_type}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                          {b.terminal}
                        </div>
                        {selBayId === String(b.id) && (
                          <div style={{ marginTop: '4px' }}>
                            <CheckCircle size={14} color="#0EA5E9" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reason — only for reassign */}
              {modalMode === 'REASSIGN' && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label>Reason for Reassignment *</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Emergency landing, VIP aircraft needs aerobridge..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px',
                            justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={`btn ${modalMode === 'REASSIGN'
                    ? 'btn-danger' : 'btn-primary'}`}
                  onClick={modalMode === 'ASSIGN'
                    ? confirmAssign : confirmReassign}
                  disabled={saving || !selBayId ||
                    (modalMode === 'REASSIGN' && !reason)}
                >
                  <CheckCircle size={14} />
                  {saving
                    ? 'Saving...'
                    : modalMode === 'ASSIGN'
                    ? 'Confirm Bay Assignment'
                    : 'Confirm Reassignment'
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}