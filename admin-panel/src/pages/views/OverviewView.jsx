import React, { useState, useEffect } from 'react';
import { Users, Briefcase, Calendar, AlertTriangle } from 'lucide-react';

export default function OverviewView({ token, host, setActiveTab }) {
  const [stats, setStats] = useState({ totalUsers: 0, totalCases: 0, pendingLeaves: 0, activeSos: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${host}:3000/api/admin/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading stats...</p>;

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
      <StatCard icon={<Briefcase size={24} color="#6366f1" />} title="Total Cases" value={stats.totalCases} onClick={() => setActiveTab('cases')} />
      <StatCard icon={<Users size={24} color="#10B981" />} title="Total Employees" value={stats.totalUsers} onClick={() => setActiveTab('users')} />
      <StatCard icon={<Calendar size={24} color="#F59E0B" />} title="Pending Leaves" value={stats.pendingLeaves} onClick={() => setActiveTab('attendance')} />
      <StatCard icon={<AlertTriangle size={24} color="#EF4444" />} title="Active SOS Alerts" value={stats.activeSos} onClick={() => setActiveTab('attendance')} />
    </div>
  );
}

function StatCard({ icon, title, value, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={(e) => { if(onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; } }}
      onMouseLeave={(e) => { if(onClick) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } }}
    >
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <h4 style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '4px' }}>{title}</h4>
        <div style={{ fontSize: '28px', fontWeight: '700' }}>{value}</div>
      </div>
    </div>
  );
}
