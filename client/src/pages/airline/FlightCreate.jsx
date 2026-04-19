import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import API     from '../../api/axios';
import toast   from 'react-hot-toast';
import { PlaneTakeoff, Plus, X } from 'lucide-react';

const SERVICES = [
  'FUEL','CATERING','CLEANING','MEDICAL',
  'CARGO','PUSHBACK_TUG','DEICING',
  'GROUND_POWER','POTABLE_WATER','LAVATORY','BAGGAGE_HANDLING'
];

export default function FlightCreate() {
  const navigate = useNavigate();
  const [aircraft, setAircraft]   = useState([]);
  const [loading,  setLoading]    = useState(false);
  const [services, setServices]   = useState([]);

  const [form, setForm] = useState({
    flight_number:        '',
    aircraft_id:          '',
    origin:               '',
    destination:          'MAA',
    scheduled_arrival:    '',
    scheduled_departure:  '',
    terminal:             'T1',
    priority:             'NORMAL',
    priority_reason:      '',
  });

  useEffect(() => {
    API.get('/flights')
      .then(() => {})
      .catch(() => {});
    // Load airline's aircraft
    API.get('/bays')
      .then(() => {})
      .catch(() => {});
    // Load aircraft for this airline
    loadAircraft();
  }, []);

  const loadAircraft = async () => {
    try {
      // We query flights to get aircraft indirectly
      // Better: add a dedicated /aircraft endpoint
      // For now use a direct approach
      const res = await API.get('/flights');
      // Extract unique aircraft from flights or load separately
    } catch {}

    // Direct aircraft fetch — we'll add this endpoint
    try {
      const res = await fetch('/api/aircraft', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (Array.isArray(data)) setAircraft(data);
    } catch {}
  };

  const toggleService = (s) => {
    setServices(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.flight_number || !form.aircraft_id ||
        !form.origin || !form.scheduled_arrival ||
        !form.scheduled_departure) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      await API.post('/flights', { ...form, services });
      toast.success(`Flight ${form.flight_number} created successfully!`);
      navigate('/airline');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create flight');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Add New Flight" />

        <div style={{ maxWidth: '700px', marginTop: '24px' }}>
          <div className="card">
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: '10px', marginBottom: '24px'
            }}>
              <div style={{
                width: '40px', height: '40px',
                background: '#E0F2FE', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <PlaneTakeoff size={20} color="#0EA5E9" />
              </div>
              <div>
                <h3 style={{ fontWeight: '700', fontSize: '16px' }}>
                  New Flight Details
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B' }}>
                  Fill in all flight information
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px'
              }}>
                {/* Flight Number */}
                <div className="form-group">
                  <label>Flight Number *</label>
                  <input
                    name="flight_number"
                    placeholder="e.g. AI202"
                    value={form.flight_number}
                    onChange={handleChange}
                  />
                </div>

                {/* Aircraft */}
                <div className="form-group">
                  <label>Aircraft *</label>
                  <select
                    name="aircraft_id"
                    value={form.aircraft_id}
                    onChange={handleChange}
                  >
                    <option value="">Select Aircraft</option>
                    {aircraft.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.registration_number} — {a.aircraft_type}
                      </option>
                    ))}
                  </select>
                  {aircraft.length === 0 && (
                    <span style={{ fontSize: '11px', color: '#F59E0B' }}>
                      ⚠ No aircraft found. Contact admin to add aircraft.
                    </span>
                  )}
                </div>

                {/* Origin */}
                <div className="form-group">
                  <label>Origin Airport *</label>
                  <input
                    name="origin"
                    placeholder="e.g. DEL"
                    value={form.origin}
                    onChange={handleChange}
                    maxLength={4}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                {/* Destination */}
                <div className="form-group">
                  <label>Destination Airport *</label>
                  <input
                    name="destination"
                    placeholder="e.g. MAA"
                    value={form.destination}
                    onChange={handleChange}
                    maxLength={4}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                {/* Scheduled Arrival */}
                <div className="form-group">
                  <label>Scheduled Arrival *</label>
                  <input
                    type="datetime-local"
                    name="scheduled_arrival"
                    value={form.scheduled_arrival}
                    onChange={handleChange}
                  />
                </div>

                {/* Scheduled Departure */}
                <div className="form-group">
                  <label>Scheduled Departure *</label>
                  <input
                    type="datetime-local"
                    name="scheduled_departure"
                    value={form.scheduled_departure}
                    onChange={handleChange}
                  />
                </div>

                {/* Terminal */}
                <div className="form-group">
                  <label>Terminal</label>
                  <select name="terminal" value={form.terminal} onChange={handleChange}>
                    <option value="T1">T1 — Domestic (KDT)</option>
                    <option value="T3">T3 — International Arrivals (AIT)</option>
                    <option value="T4">T4 — International Departures</option>
                  </select>
                </div>

                {/* Priority */}
                <div className="form-group">
                  <label>Priority Level</label>
                  <select name="priority" value={form.priority} onChange={handleChange}>
                    <option value="NORMAL">Normal</option>
                    <option value="VIP">VIP</option>
                    <option value="VVIP">VVIP</option>
                    <option value="MEDICAL">Medical Emergency</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>

                {/* Priority Reason */}
                {form.priority !== 'NORMAL' && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Priority Reason *</label>
                    <input
                      name="priority_reason"
                      placeholder="Describe the reason for priority..."
                      value={form.priority_reason}
                      onChange={handleChange}
                    />
                  </div>
                )}
              </div>

              {/* Services */}
              <div style={{ marginTop: '20px' }}>
                <label style={{
                  fontSize: '13px', fontWeight: '600',
                  display: 'block', marginBottom: '10px'
                }}>
                  Services Required
                </label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '8px'
                }}>
                  {SERVICES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleService(s)}
                      className={`btn btn-sm ${services.includes(s) ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {services.includes(s) && <X size={11} />}
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div style={{
                display: 'flex', gap: '12px',
                marginTop: '24px', justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate('/airline')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  <Plus size={15} />
                  {loading ? 'Creating...' : 'Create Flight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}