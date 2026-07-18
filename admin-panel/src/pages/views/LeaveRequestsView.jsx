import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

export default function LeaveRequestsView({ token, host }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://nexus-app-wj39.onrender.com/api/admin/leaves`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setLeaves(data.leaves);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await fetch(`https://nexus-app-wj39.onrender.com/api/admin/leaves/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id, status })
      });
      const data = await res.json();
      if (data.success) {
        fetchLeaves(); // refresh list
      }
    } catch (e) {
      alert('Failed to update leave status');
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading leave requests...</p>;

  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Leave Requests</h2>

      <div style={{ display: 'grid', gap: '16px' }}>
        {leaves.map((leave) => (
          <div key={leave._id} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{leave.user_email}</h3>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', display: 'flex', gap: '16px', marginBottom: '8px' }}>
                <span>Type: <strong>{leave.leave_type}</strong></span>
                <span>From: {leave.start_date}</span>
                <span>To: {leave.end_date}</span>
              </div>
              <span style={{ 
                padding: '4px 8px', borderRadius: '4px', fontSize: '12px', 
                background: leave.status === 'Approved' ? 'rgba(16, 185, 129, 0.1)' : leave.status === 'Rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                color: leave.status === 'Approved' ? '#10B981' : leave.status === 'Rejected' ? '#EF4444' : '#F59E0B' 
              }}>
                {leave.status}
              </span>
            </div>
            
            {leave.status === 'Pending' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleUpdateStatus(leave._id, 'Approved')} style={{ background: '#10B981', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={18} />
                </button>
                <button onClick={() => handleUpdateStatus(leave._id, 'Rejected')} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        ))}
        {leaves.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No leave requests found.</p>}
      </div>
    </div>
  );
}
