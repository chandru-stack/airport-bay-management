import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Plane, LayoutDashboard, PlaneTakeoff,
  Upload, MessageSquare, History,
  Radio, GitBranch, LogOut, Layers
} from 'lucide-react';

const navItems = {
  AIRLINE: [
    { to: '/airline',                 icon: <LayoutDashboard size={17} />, label: 'Dashboard'       },
    { to: '/airline/flights/new',     icon: <PlaneTakeoff    size={17} />, label: 'Add Flight'      },
    { to: '/airline/schedule-upload', icon: <Upload          size={17} />, label: 'Upload Schedule' },
    { to: '/airline/messages',        icon: <MessageSquare   size={17} />, label: 'Messages'        },
    { to: '/airline/history',         icon: <History         size={17} />, label: 'History'         },
  ],
  AOCC: [
    { to: '/aocc',            icon: <LayoutDashboard size={17} />, label: 'Dashboard'      },
    { to: '/aocc/allocation', icon: <Layers          size={17} />, label: 'Bay Allocation' },
    { to: '/aocc/conflicts',  icon: <GitBranch       size={17} />, label: 'Conflicts'      },
    { to: '/aocc/messages',   icon: <MessageSquare   size={17} />, label: 'Messages'       },
    { to: '/aocc/history',    icon: <History         size={17} />, label: 'History'        },
  ],
  ATC: [
    { to: '/atc',          icon: <LayoutDashboard size={17} />, label: 'Dashboard' },
    { to: '/atc/messages', icon: <MessageSquare   size={17} />, label: 'Messages'  },
    { to: '/atc/history',  icon: <History         size={17} />, label: 'History'   },
  ],
  APRON: [
    { to: '/apron',          icon: <LayoutDashboard size={17} />, label: 'Bay Grid'  },
    { to: '/apron/messages', icon: <MessageSquare   size={17} />, label: 'Messages'  },
    { to: '/apron/history',  icon: <History         size={17} />, label: 'History'   },
  ],
};

const roleColors = {
  AIRLINE: '#0EA5E9',
  AOCC:    '#7C3AED',
  ATC:     '#059669',
  APRON:   '#D97706',
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const items = navItems[user?.role] || [];
  const color = roleColors[user?.role] || '#0EA5E9';

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{
          width: '36px', height: '36px',
          background: color,
          borderRadius: '10px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <Plane size={20} color="white" />
        </div>
        <div>
          <div className="sidebar-logo-text">MAA Airport</div>
          <div className="sidebar-logo-sub">Bay Management</div>
        </div>
      </div>

      {/* Role Badge */}
      <div style={{ padding: '10px 20px' }}>
        <span style={{
          background: color + '20',
          color: color,
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.5px',
        }}>
          {user?.role} PORTAL
        </span>
      </div>

      {/* Nav Items */}
      <nav className="sidebar-nav">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/airline' ||
                 item.to === '/aocc'    ||
                 item.to === '/atc'     ||
                 item.to === '/apron'}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'active' : ''}`
            }
            style={({ isActive }) => isActive ? { color } : {}}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: color }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-username" style={{
              whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user?.name}
            </div>
            <div className="sidebar-role">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', color: '#94A3B8',
              padding: '4px', borderRadius: '6px',
            }}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}