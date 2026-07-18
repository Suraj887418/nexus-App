import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Briefcase, LogOut, LayoutDashboard, 
  Clock, Calendar, AlertTriangle 
} from 'lucide-react';

import OverviewView from './views/OverviewView';
import CasesView from './views/CasesView';
import EmployeesView from './views/EmployeesView';
import AttendanceView from './views/AttendanceView';
import SOSAlertsView from './views/SOSAlertsView';
import LeaveRequestsView from './views/LeaveRequestsView';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');
  const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { id: 'cases', label: 'Case Management', icon: <Briefcase size={18} /> },
    { id: 'users', label: 'Employees', icon: <Users size={18} /> },
    { id: 'attendance', label: 'Attendance', icon: <Clock size={18} /> },
    { id: 'leaves', label: 'Leave Requests', icon: <Calendar size={18} /> },
    { id: 'sos', label: 'SOS Alerts', icon: <AlertTriangle size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '260px', padding: '24px', margin: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo.png" alt="Nexus Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Admin Panel</h2>
        </div>

        {navItems.map(item => (
          <div 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{ 
              padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', 
              background: activeTab === item.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent', 
              color: activeTab === item.id ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === item.id ? '600' : '500'
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        <div 
          onClick={handleLogout}
          style={{ padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: '#fca5a5' }}
        >
          <LogOut size={18} />
          <span style={{ fontWeight: '500' }}>Secure Logout</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '16px', paddingLeft: 0 }}>
        <div className="glass-panel" style={{ width: '100%', height: '100%', padding: '32px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700' }}>
              {navItems.find(n => n.id === activeTab)?.label}
            </h1>
          </div>

          {activeTab === 'overview' && <OverviewView token={token} host={host} setActiveTab={setActiveTab} />}
          {activeTab === 'cases' && <CasesView token={token} host={host} />}
          {activeTab === 'users' && <EmployeesView token={token} host={host} />}
          {activeTab === 'attendance' && <AttendanceView token={token} host={host} />}
          {activeTab === 'leaves' && <LeaveRequestsView token={token} host={host} />}
          {activeTab === 'sos' && <SOSAlertsView token={token} host={host} />}
        </div>
      </div>
    </div>
  );
}
