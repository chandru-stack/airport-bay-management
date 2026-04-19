import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plane, Lock, Mail, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const roleRoutes = {
    AIRLINE: '/airline',
    AOCC:    '/aocc',
    ATC:     '/atc',
    APRON:   '/apron',
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome, ${user.name}!`);
      navigate(roleRoutes[user.role] || '/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Quick login helpers for testing
  const quickLogins = [
    { label: 'AOCC',    email: 'aocc@maa.airport.in',  role: 'AOCC'    },
    { label: 'ATC',     email: 'atc@maa.airport.in',   role: 'ATC'     },
    { label: 'Apron',   email: 'apron@maa.airport.in', role: 'APRON'   },
    { label: 'Airline', email: 'ops.user@airindia.in', role: 'AIRLINE' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #E0F2FE 0%, #FFFFFF 50%, #E0F2FE 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px',
            background: '#0EA5E9',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 20px rgba(14,165,233,0.3)',
          }}>
            <Plane size={32} color="white" />
          </div>
          <h1 style={{
            fontSize: '24px', fontWeight: '800',
            color: '#0F172A', marginBottom: '4px'
          }}>
            Airport Bay Management
          </h1>
          <p style={{ color: '#64748B', fontSize: '13px' }}>
            Chennai International Airport (MAA)
          </p>
        </div>

        {/* Login Card */}
        <div className="card" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <h2 style={{
            fontSize: '18px', fontWeight: '700',
            marginBottom: '20px', color: '#0F172A'
          }}>
            Sign In
          </h2>

          <form onSubmit={handleLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Email */}
              <div className="form-group">
                <label>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{
                    position: 'absolute', left: '10px',
                    top: '50%', transform: 'translateY(-50%)',
                    color: '#94A3B8'
                  }} />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: '10px',
                    top: '50%', transform: 'translateY(-50%)',
                    color: '#94A3B8'
                  }} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ paddingLeft: '32px', paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    style={{
                      position: 'absolute', right: '10px',
                      top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: '#94A3B8', padding: 0
                    }}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Quick Login */}
          <div style={{ marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '10px', textAlign: 'center' }}>
              Quick Login (Testing)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {quickLogins.map(q => (
                <button
                  key={q.role}
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: 'center' }}
                  onClick={() => {
                    setEmail(q.email);
                    setPassword('Airport@123');
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px', textAlign: 'center' }}>
              All passwords: Airport@123
            </p>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#94A3B8' }}>
          Automated Bay Allocation and Management System v1.0
        </p>
      </div>
    </div>
  );
}