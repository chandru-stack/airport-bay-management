import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Topbar  from '../../components/Topbar';
import API     from '../../api/axios';
import toast   from 'react-hot-toast';
import { Upload, FileText, CheckCircle, AlertTriangle, Download } from 'lucide-react';

export default function ScheduleUpload() {
  const [file,     setFile]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [uploads,  setUploads]  = useState([]);
  const [result,   setResult]   = useState(null);

  useEffect(() => {
    API.get('/uploads')
      .then(r => setUploads(r.data))
      .catch(() => {});
  }, []);

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a CSV file'); return; }
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('schedule', file);
      const res = await API.post('/uploads/schedule', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
      toast.success(`Processed ${res.data.processed} flights!`);
      // Reload upload history
      const history = await API.get('/uploads');
      setUploads(history.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  const downloadTemplate = () => {
    const csv = [
      'flight_number,aircraft_reg,origin,destination,scheduled_arrival,scheduled_departure,terminal,priority',
      'AI202,VT-PPB,DEL,MAA,2025-06-01 08:30,2025-06-01 10:00,T1,NORMAL',
      'AI204,VT-PPB,BOM,MAA,2025-06-01 11:00,2025-06-01 12:30,T1,NORMAL',
      '6E301,VT-IZA,HYD,MAA,2025-06-01 14:00,2025-06-01 15:30,T1,NORMAL',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'schedule_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = {
    DONE:       'badge-green',
    PROCESSING: 'badge-yellow',
    PENDING:    'badge-yellow',
    ERROR:      'badge-red',
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Upload Flight Schedule" />

        <div style={{ maxWidth: '700px', marginTop: '24px',
                      display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Upload Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontWeight: '700', fontSize: '15px' }}>
                Upload CSV Schedule
              </h3>
              <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                <Download size={13} /> Download Template
              </button>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => document.getElementById('csv-input').click()}
              style={{
                border: '2px dashed #CBD5E1',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: file ? '#F0F9FF' : '#F8FAFC',
                borderColor: file ? '#0EA5E9' : '#CBD5E1',
                transition: 'all 0.2s',
              }}
            >
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files[0])}
              />
              {file ? (
                <>
                  <FileText size={40} color="#0EA5E9"
                    style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: '600', color: '#0EA5E9' }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    {(file.size / 1024).toFixed(1)} KB — Click to change
                  </p>
                </>
              ) : (
                <>
                  <Upload size={40} color="#94A3B8"
                    style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: '600', color: '#334155' }}>
                    Click to select CSV file
                  </p>
                  <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>
                    Supports 6-month to 1-year flight schedules
                  </p>
                </>
              )}
            </div>

            {/* CSV Format Info */}
            <div style={{
              marginTop: '16px', background: '#F8FAFC',
              borderRadius: '8px', padding: '12px 14px',
              fontSize: '12px', color: '#64748B'
            }}>
              <strong style={{ color: '#334155' }}>Required columns:</strong>{' '}
              flight_number, aircraft_reg, origin, destination,
              scheduled_arrival, scheduled_departure, terminal, priority
            </div>

            <button
              className="btn btn-primary"
              style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }}
              onClick={handleUpload}
              disabled={loading || !file}
            >
              <Upload size={15} />
              {loading ? 'Processing...' : 'Upload & Process Schedule'}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="card" style={{
              borderLeft: `4px solid ${result.failed > 0 ? '#F59E0B' : '#10B981'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center',
                            gap: '10px', marginBottom: '12px' }}>
                {result.failed > 0
                  ? <AlertTriangle size={20} color="#F59E0B" />
                  : <CheckCircle  size={20} color="#10B981" />
                }
                <h4 style={{ fontWeight: '700' }}>Upload Result</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '12px' }}>
                {[
                  { label: 'Total Rows',  value: result.total,     color: '#64748B' },
                  { label: 'Processed',   value: result.processed, color: '#10B981' },
                  { label: 'Failed',      value: result.failed,    color: '#EF4444' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: '#F8FAFC', borderRadius: '8px',
                    padding: '12px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {result.errors?.length > 0 && (
                <div style={{
                  marginTop: '12px', background: '#FEF2F2',
                  borderRadius: '8px', padding: '10px 12px',
                  fontSize: '12px', color: '#991B1B'
                }}>
                  <strong>Errors:</strong>
                  <ul style={{ marginTop: '6px', paddingLeft: '16px' }}>
                    {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Upload History */}
          <div className="card">
            <h3 style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px' }}>
              Upload History
            </h3>
            {uploads.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center',
                          padding: '20px' }}>
                No uploads yet
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Total</th>
                      <th>Processed</th>
                      <th>Failed</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: '600' }}>{u.file_name}</td>
                        <td>{u.total_flights}</td>
                        <td style={{ color: '#10B981' }}>{u.processed_flights}</td>
                        <td style={{ color: u.failed_flights > 0 ? '#EF4444' : '#64748B' }}>
                          {u.failed_flights}
                        </td>
                        <td>
                          <span className={`badge ${statusBadge[u.upload_status] || 'badge-gray'}`}>
                            {u.upload_status}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>
                          {new Date(u.created_at).toLocaleDateString()}
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