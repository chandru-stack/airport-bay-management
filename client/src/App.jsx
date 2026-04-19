import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';

// Airline
import AirlineDashboard  from './pages/airline/AirlineDashboard';
import FlightCreate      from './pages/airline/FlightCreate';
import ScheduleUpload    from './pages/airline/ScheduleUpload';
import AirlineMessages   from './pages/airline/AirlineMessages';
import AirlineHistory    from './pages/airline/AirlineHistory';

// AOCC
import AOCCDashboard     from './pages/aocc/AOCCDashboard';
import BayAllocation     from './pages/aocc/BayAllocation';
import ConflictManager   from './pages/aocc/ConflictManager';
import AOCCMessages      from './pages/aocc/AOCCMessages';
import AOCCHistory       from './pages/aocc/AOCCHistory';

// ATC
import ATCDashboard      from './pages/atc/ATCDashboard';
import ATCMessages       from './pages/atc/ATCMessages';
import ATCHistory    from './pages/atc/ATCHistory';
// Apron
import ApronDashboard    from './pages/apron/ApronDashboard';
import ApronHistory      from './pages/apron/ApronHistory';
import ApronMessages from './pages/apron/ApronMessages';
// Protected route wrapper
const Protected = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', height: '100vh',
      flexDirection: 'column', gap: '12px',
      color: '#0EA5E9', fontSize: '15px'
    }}>
      <div style={{
        width: '40px', height: '40px',
        border: '3px solid #E0F2FE',
        borderTop: '3px solid #0EA5E9',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      Loading...
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/login" />} />

      {/* Airline Routes */}
      <Route path="/airline" element={
        <Protected roles={['AIRLINE']}>
          <AirlineDashboard />
        </Protected>
      } />
      <Route path="/airline/flights/new" element={
        <Protected roles={['AIRLINE']}>
          <FlightCreate />
        </Protected>
      } />
      <Route path="/airline/schedule-upload" element={
        <Protected roles={['AIRLINE']}>
          <ScheduleUpload />
        </Protected>
      } />
      <Route path="/airline/messages" element={
        <Protected roles={['AIRLINE']}>
          <AirlineMessages />
        </Protected>
      } />
      <Route path="/airline/history" element={
        <Protected roles={['AIRLINE']}>
          <AirlineHistory />
        </Protected>
      } />

      {/* AOCC Routes */}
      <Route path="/aocc" element={
        <Protected roles={['AOCC']}>
          <AOCCDashboard />
        </Protected>
      } />
      <Route path="/aocc/allocation" element={
        <Protected roles={['AOCC']}>
          <BayAllocation />
        </Protected>
      } />
      <Route path="/aocc/conflicts" element={
        <Protected roles={['AOCC']}>
          <ConflictManager />
        </Protected>
      } />
      <Route path="/aocc/messages" element={
        <Protected roles={['AOCC']}>
          <AOCCMessages />
        </Protected>
      } />
      <Route path="/aocc/history" element={
        <Protected roles={['AOCC']}>
          <AOCCHistory />
        </Protected>
      } />

      {/* ATC Routes */}
      <Route path="/atc" element={
        <Protected roles={['ATC']}>
          <ATCDashboard />
        </Protected>
      } />
      <Route path="/atc/messages" element={
        <Protected roles={['ATC']}>
          <ATCMessages />
        </Protected>
      } />
      {/* Add inside ATC routes */}
        <Route path="/atc/history" element={
        <Protected roles={['ATC']}>
        <ATCHistory />
        </Protected>
       } />

      {/* Apron Routes */}
      <Route path="/apron" element={
        <Protected roles={['APRON']}>
          <ApronDashboard />
        </Protected>
      } />
      <Route path="/apron/history" element={
        <Protected roles={['APRON']}>
          <ApronHistory />
        </Protected>
      } />
      {/* Add inside Apron routes */}
       <Route path="/apron/messages" element={
       <Protected roles={['APRON']}>
       <ApronMessages />
       </Protected>
       } />
    </Routes>
  );
}