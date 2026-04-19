import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import API     from '../../api/axios';
import { History, Search } from 'lucide-react';

export default function ApronHistory() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [date,    setDate]    = useState('');
  const [flight,  setFlight]  = useState('');

  const loadEvents = () => {
    setLoading(true);
    let url = '/apron/history?';
    if (date)   url += `date=${date}&`;
    if (flight) url += `flight_number=${flight}`;
    API.get(url)
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEvents(); }, []);

  const eventColor = {
    ON_BLOCK:  'badge-green',
    PUSHBACK:  'badge-yellow',
    OFF_BLOCK: 'badge-gray',
  };

  const eventIcon = {
    ON_BLOCK:  '🛬',
    PUSHBACK:  '🔄',
    OFF_BLOCK: '🛫',
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Apron History" />

        <div style={{ marginTop: '24px' }}>
          {/* Filters */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                <label>Filter by Date</label>
                <input type="date" value={date}
                  onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                <label>Filter by Flight Number</label>
                <input placeholder="e.g. AI202" value={flight}
                  onChange={e => setFlight(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={loadEvents}>
                <Search size={14} /> Search
              </button>
              <button className="btn btn-outline" onClick={() => {
                setDate(''); setFlight(''); loadEvents();
              }}>
                Clear
              </button>
            </div>
          </div>

          {/* Events Table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: '8px', marginBottom: '16px' }}>
              <History size={18} color="#D97706" />
              <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                Apron Event Log
                <span style={{ fontSize: '12px', color: '#94A3B8',
                               fontWeight: '400', marginLeft: '8px' }}>
                  ({events.length} records)
                </span>
              </h3>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                Loading history...
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Flight</th>
                      <th>Bay</th>
                      <th>Terminal</th>
                      <th>Airline</th>
                      <th>Recorded By</th>
                      <th>Notes</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center',
                          padding: '30px', color: '#94A3B8' }}>
                          No events found
                        </td>
                      </tr>
                    ) : events.map(e => (
                      <tr key={e.id}>
                        <td>
                          <span className={`badge ${eventColor[e.event_type] || 'badge-gray'}`}>
                            {eventIcon[e.event_type]} {e.event_type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: '700', color: '#D97706' }}>
                            {e.flight_number}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-blue">{e.bay_number}</span>
                        </td>
                        <td>
                          <span className="badge badge-gray">{e.terminal}</span>
                        </td>
                        <td style={{ fontSize: '12px' }}>{e.airline_name}</td>
                        <td style={{ fontSize: '12px' }}>{e.recorded_by_name}</td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>
                          {e.notes || '—'}
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>
                          {new Date(e.event_time).toLocaleString()}
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