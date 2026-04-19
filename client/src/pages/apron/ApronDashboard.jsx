import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import { useSocket } from '../../context/SocketContext';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { Search, RefreshCw, CheckCircle, Clock } from 'lucide-react';

const bayStatusStyle = {
  AVAILABLE:   { bg: '#F0FDF4', border: '#86EFAC', dot: '#10B981', label: 'Available'   },
  OCCUPIED:    { bg: '#EFF6FF', border: '#93C5FD', dot: '#3B82F6', label: 'Occupied'    },
  BLOCKED:     { bg: '#FEF2F2', border: '#FCA5A5', dot: '#EF4444', label: 'Blocked'     },
  MAINTENANCE: { bg: '#FFFBEB', border: '#FCD34D', dot: '#F59E0B', label: 'Maintenance' },
};

const formatSizes = (sizes) => {
  if (!sizes) return 'N/A';
  if (Array.isArray(sizes)) return sizes.join(', ');
  return String(sizes).replace(/[{}"]/g, '');
};

export default function ApronDashboard() {
  const socket = useSocket();
  const [bays,       setBays]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [terminal,   setTerminal]   = useState('ALL');
  const [statusF,    setStatusF]    = useState('ALL');
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [selBay,     setSelBay]     = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [saving,     setSaving]     = useState(false);

  const loadBays = () => {
    setLoading(true);
    let url = '/apron/bays?';
    if (terminal !== 'ALL') url += `terminal=${terminal}&`;
    if (statusF  !== 'ALL') url += `status=${statusF}`;
    API.get(url)
      .then(r => setBays(r.data))
      .catch(() => toast.error('Failed to load bays'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBays(); }, [terminal, statusF]);

  useEffect(() => {
    if (!socket) return;
    socket.on('bay:status_update', loadBays);
    socket.on('flight:on_block',   loadBays);
    socket.on('flight:off_block',  loadBays);
    socket.on('aocc:bay_assigned', loadBays);
    socket.on('aocc:delay_alert', (data) => {
      toast.error(`⚠️ Delay: ${data.message}`, { duration: 8000 });
    });
    return () => {
      socket.off('bay:status_update');
      socket.off('flight:on_block');
      socket.off('flight:off_block');
      socket.off('aocc:bay_assigned');
      socket.off('aocc:delay_alert');
    };
  }, [socket]);

  const doLifecycle = async (action) => {
    if (!selBay?.allocation_id) {
      toast.error('No active allocation for this bay');
      return;
    }
    setSaving(true);
    try {
      await API.post(`/apron/${action}`, {
        bay_allocation_id: selBay.allocation_id,
        notes: actionNote || null,
      });
      const labels = {
        'on-block':  'ON-BLOCK recorded ✅',
        'pushback':  'PUSHBACK recorded 🔄',
        'off-block': 'OFF-BLOCK recorded ✈️ Bay is now free!',
      };
      toast.success(labels[action]);
      setShowModal(false);
      setActionNote('');
      loadBays();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = bays.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.bay_number?.toLowerCase().includes(s) ||
      b.flight_number?.toLowerCase().includes(s) ||
      b.airline_name?.toLowerCase().includes(s)
    );
  });

  const available   = bays.filter(b => b.status === 'AVAILABLE').length;
  const occupied    = bays.filter(b => b.status === 'OCCUPIED').length;
  const blocked     = bays.filter(b => b.status === 'BLOCKED').length;
  const maintenance = bays.filter(b => b.status === 'MAINTENANCE').length;

  const getNextActions = (bay) => {
  if (!bay.flight_id) return [];

  // Must be LANDED or LANDING_SOON before ON-BLOCK
  const canOnBlock = ['LANDED', 'LANDING_SOON', 'ON_BLOCK',
                      'PUSHBACK'].includes(bay.flight_status);

  if (!bay.on_block_time) {
    if (!canOnBlock) {
      return [{ 
        label: `Waiting for landing (Status: ${bay.flight_status})`,
        action: null,
        color: 'btn-outline',
        disabled: true
      }];
    }
    return [{ label: 'Record ON-BLOCK', action: 'on-block', color: 'btn-success' }];
  }
    if (bay.on_block_time && !bay.pushback_time) {
      return [{ label: 'Record PUSHBACK',  action: 'pushback',  color: 'btn-warning' }];
    }
    if (bay.pushback_time && !bay.off_block_time) {
      return [{ label: 'Record OFF-BLOCK', action: 'off-block', color: 'btn-primary' }];
    }
    return [];
  };

  const openModal = (bay) => {
    setSelBay(bay);
    setActionNote('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelBay(null);
    setActionNote('');
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Apron — Bay Operations" />

        {/* Stats */}
        <div className="stats-row" style={{ marginTop: '24px' }}>
          {[
            { label: 'Available',   value: available,   color: '#10B981' },
            { label: 'Occupied',    value: occupied,    color: '#3B82F6' },
            { label: 'Blocked',     value: blocked,     color: '#EF4444' },
            { label: 'Maintenance', value: maintenance, color: '#F59E0B' },
            { label: 'Total Bays',  value: bays.length, color: '#64748B' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div style={{
                width: '12px', height: '12px',
                borderRadius: '50%', background: s.color, flexShrink: 0
              }} />
              <div>
                <div className="stat-value" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px',
                        alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
              <label>Search Bay / Flight / Airline</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{
                  position: 'absolute', left: '10px',
                  top: '50%', transform: 'translateY(-50%)', color: '#94A3B8'
                }} />
                <input
                  placeholder="e.g. T1-AB-01 or AI202"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: '30px' }}
                />
              </div>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label>Terminal</label>
              <select value={terminal} onChange={e => setTerminal(e.target.value)}>
                <option value="ALL">All Terminals</option>
                <option value="T1">T1 — Domestic</option>
                <option value="T3">T3 — Intl Arrivals</option>
                <option value="T4">T4 — Intl Departures</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label>Bay Status</label>
              <select value={statusF} onChange={e => setStatusF(e.target.value)}>
                <option value="ALL">All Status</option>
                <option value="AVAILABLE">Available</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="BLOCKED">Blocked</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <button className="btn btn-outline btn-sm" onClick={loadBays}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* Bay Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>
            Loading bay grid...
          </div>
        ) : (
          <>
            {['T1', 'T3', 'T4'].map(t => {
              const termBays = filtered.filter(b => b.terminal === t);
              if (termBays.length === 0) return null;
              return (
                <div key={t} style={{ marginBottom: '24px' }}>
                  <h3 style={{
                    fontWeight: '700', fontSize: '14px', color: '#64748B',
                    marginBottom: '12px', textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Terminal {t}
                    <span style={{ fontSize: '12px', marginLeft: '8px',
                                   color: '#94A3B8', fontWeight: '400' }}>
                      ({termBays.length} bays)
                    </span>
                  </h3>
                  <div className="bay-grid">
                    {termBays.map(bay => {
                      const st = bayStatusStyle[bay.status] || bayStatusStyle.AVAILABLE;
                      return (
                        <div
                          key={bay.id}
                          className={`bay-card ${bay.status?.toLowerCase()}`}
                          style={{
                            background: st.bg,
                            borderColor: st.border,
                            cursor: 'pointer'
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openModal(bay);
                          }}
                        >
                          <div style={{ display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start' }}>
                            <div className="bay-number">{bay.bay_number}</div>
                            <div style={{
                              width: '8px', height: '8px',
                              borderRadius: '50%', background: st.dot,
                              marginTop: '4px'
                            }} />
                          </div>
                          <div className="bay-type">
                            {bay.bay_type} · {bay.terminal}
                          </div>
                          {bay.flight_number ? (
                            <div style={{ marginTop: '8px' }}>
                              <div className="bay-flight">
                                ✈️ {bay.flight_number}
                              </div>
                              <div style={{ fontSize: '11px',
                                            color: '#64748B', marginTop: '2px' }}>
                                {bay.airline_name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                                {bay.aircraft_type}
                              </div>
                              <div style={{ marginTop: '6px' }}>
                                {bay.off_block_time ? (
                                  <span className="badge badge-gray"
                                    style={{ fontSize: '10px' }}>OFF-BLOCK</span>
                                ) : bay.pushback_time ? (
                                  <span className="badge badge-yellow"
                                    style={{ fontSize: '10px' }}>PUSHBACK</span>
                                ) : bay.on_block_time ? (
                                  <span className="badge badge-green"
                                    style={{ fontSize: '10px' }}>ON-BLOCK</span>
                                ) : (
                                  <span className="badge badge-blue"
                                    style={{ fontSize: '10px' }}>ARRIVING</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ marginTop: '8px', fontSize: '12px',
                                          color: '#10B981', fontWeight: '600' }}>
                              {st.label}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Modal */}
        {showModal && selBay && (
          <div
            className="modal-overlay"
            onClick={closeModal}
          >
            <div
              className="modal"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '480px' }}
            >
              {/* Header */}
              <div className="modal-header">
                <h3 className="modal-title">Bay {selBay.bay_number}</h3>
                <button
                  onClick={closeModal}
                  style={{ background: 'none', border: 'none',
                           cursor: 'pointer', color: '#94A3B8',
                           fontSize: '18px' }}
                >✕</button>
              </div>

              {/* Bay Info */}
              <div style={{
                background: '#F8FAFC', borderRadius: '10px',
                padding: '14px', marginBottom: '16px',
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '10px', fontSize: '13px'
              }}>
                <div>
                  <span style={{ color: '#94A3B8' }}>Type:</span>
                  <strong style={{ marginLeft: '6px' }}>{selBay.bay_type}</strong>
                </div>
                <div>
                  <span style={{ color: '#94A3B8' }}>Terminal:</span>
                  <strong style={{ marginLeft: '6px' }}>{selBay.terminal}</strong>
                </div>
                <div>
                  <span style={{ color: '#94A3B8' }}>Status:</span>
                  <strong style={{ marginLeft: '6px' }}>{selBay.status}</strong>
                </div>
                <div>
                  <span style={{ color: '#94A3B8' }}>Sizes:</span>
                  <strong style={{ marginLeft: '6px' }}>
                    {formatSizes(selBay.compatible_sizes)}
                  </strong>
                </div>
              </div>

              {/* Flight Info */}
              {selBay.flight_number && (
                <div style={{
                  background: '#EFF6FF', borderRadius: '10px',
                  padding: '14px', marginBottom: '16px', fontSize: '13px'
                }}>
                  <div style={{ fontWeight: '700', color: '#1D4ED8',
                                marginBottom: '8px', fontSize: '14px' }}>
                    ✈️ {selBay.flight_number}
                  </div>
                  <div style={{ display: 'grid',
                                gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <span style={{ color: '#94A3B8' }}>Airline:</span>
                      <span style={{ marginLeft: '6px' }}>{selBay.airline_name}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94A3B8' }}>Aircraft:</span>
                      <span style={{ marginLeft: '6px' }}>{selBay.aircraft_type}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94A3B8' }}>Priority:</span>
                      <span style={{ marginLeft: '6px' }}>{selBay.priority}</span>
                    </div>
                  </div>

                  {/* Lifecycle Timeline */}
                  <div style={{ marginTop: '12px', display: 'flex',
                                gap: '4px', alignItems: 'center' }}>
                    {[
                      { label: 'ON-BLOCK',  time: selBay.on_block_time  },
                      { label: 'PUSHBACK',  time: selBay.pushback_time  },
                      { label: 'OFF-BLOCK', time: selBay.off_block_time },
                    ].map((step, i) => (
                      <div key={i} style={{ display: 'flex',
                                            alignItems: 'center', gap: '4px' }}>
                        {i > 0 && (
                          <div style={{
                            width: '20px', height: '2px',
                            background: step.time ? '#10B981' : '#E2E8F0'
                          }} />
                        )}
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: step.time ? '#10B981' : '#E2E8F0',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto'
                          }}>
                            {step.time
                              ? <CheckCircle size={14} color="white" />
                              : <Clock size={14} color="#94A3B8" />
                            }
                          </div>
                          <div style={{
                            fontSize: '10px', marginTop: '3px', fontWeight: '600',
                            color: step.time ? '#10B981' : '#94A3B8'
                          }}>
                            {step.label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Notes (optional)</label>
                <input
                  placeholder="Add any notes..."
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              {selBay.flight_number ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getNextActions(selBay).map(a => (
  <button
    key={a.action || 'waiting'}
    className={`btn ${a.color}`}
    style={{ width: '100%', justifyContent: 'center' }}
    onClick={() => a.action && doLifecycle(a.action)}
    disabled={saving || a.disabled}
  >
    {saving ? 'Recording...' : a.label}
  </button>
))}
                  {getNextActions(selBay).length === 0 && (
                    <div style={{
                      textAlign: 'center', color: '#10B981',
                      fontSize: '13px', fontWeight: '600', padding: '10px'
                    }}>
                      ✅ Lifecycle complete for this flight
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center', color: '#94A3B8',
                  fontSize: '13px', padding: '10px'
                }}>
                  No active flight at this bay
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}