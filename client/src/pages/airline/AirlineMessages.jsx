import Sidebar    from '../../components/Sidebar';
import Topbar     from '../../components/Topbar';
import ChatPanel  from '../../components/ChatPanel';
import { MessageSquare } from 'lucide-react';

export default function AirlineMessages() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Messages" />
        <div style={{ maxWidth: '700px', marginTop: '24px' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '40px', height: '40px', background: '#E0F2FE',
                borderRadius: '10px', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <MessageSquare size={20} color="#0EA5E9" />
              </div>
              <div>
                <h3 style={{ fontWeight: '700' }}>Communication Center</h3>
                <p style={{ fontSize: '12px', color: '#64748B' }}>
                  Direct communication with AOCC
                </p>
              </div>
            </div>
            <ChatPanel toRole="AOCC" />
          </div>
        </div>
      </div>
    </div>
  );
}