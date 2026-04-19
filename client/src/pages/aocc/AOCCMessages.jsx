import { useState } from 'react';
import Sidebar   from '../../components/Sidebar';
import Topbar    from '../../components/Topbar';
import ChatPanel from '../../components/ChatPanel';
import { MessageSquare } from 'lucide-react';

export default function AOCCMessages() {
  const [activeTab, setActiveTab] = useState('AIRLINE');
  const tabs = ['AIRLINE','ATC','APRON'];

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Communications Center" />
        <div style={{ maxWidth: '750px', marginTop: '24px' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center',
                          gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '40px', height: '40px', background: '#F5F3FF',
                borderRadius: '10px', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <MessageSquare size={20} color="#7C3AED" />
              </div>
              <div>
                <h3 style={{ fontWeight: '700' }}>AOCC Communications</h3>
                <p style={{ fontSize: '12px', color: '#64748B' }}>
                  Communicate with all operational teams
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {tabs.map(t => (
                <button
                  key={t}
                  className={`btn btn-sm ${activeTab === t ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <ChatPanel toRole={activeTab} />
          </div>
        </div>
      </div>
    </div>
  );
}