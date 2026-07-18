import React, { useState, useEffect } from 'react';

export default function AttendanceView({ token, host }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${host}:3000/api/admin/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAttendance(data.attendance);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading attendance...</p>;

  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Attendance Logs</h2>
      
      <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ padding: '16px', fontWeight: '600', fontSize: '13px', color: 'var(--text-muted)' }}>Employee Email</th>
              <th style={{ padding: '16px', fontWeight: '600', fontSize: '13px', color: 'var(--text-muted)' }}>Date</th>
              <th style={{ padding: '16px', fontWeight: '600', fontSize: '13px', color: 'var(--text-muted)' }}>Punch In</th>
              <th style={{ padding: '16px', fontWeight: '600', fontSize: '13px', color: 'var(--text-muted)' }}>Punch Out</th>
              <th style={{ padding: '16px', fontWeight: '600', fontSize: '13px', color: 'var(--text-muted)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((log) => (
              <tr key={log._id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <td style={{ padding: '16px', fontSize: '14px' }}>{log.user_email}</td>
                <td style={{ padding: '16px', fontSize: '14px' }}>{log.attendance_date}</td>
                <td style={{ padding: '16px', fontSize: '14px' }}>{log.punch_in_time ? new Date(log.punch_in_time).toLocaleTimeString() : '-'}</td>
                <td style={{ padding: '16px', fontSize: '14px' }}>{log.punch_out_time ? new Date(log.punch_out_time).toLocaleTimeString() : '-'}</td>
                <td style={{ padding: '16px', fontSize: '14px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: log.status === 'Present' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: log.status === 'Present' ? '#10B981' : '#F59E0B' }}>
                    {log.status || 'N/A'}
                  </span>
                </td>
              </tr>
            ))}
            {attendance.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No attendance logs found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
