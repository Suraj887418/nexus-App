import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function EmployeesView({ token, host }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${host}:3000/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading employees...</p>;

  return (
    <div className="animate-fade-in">
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>Manage Employees</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {users.map((u) => (
          <div 
            key={u._id} 
            onClick={() => setSelectedUser(u)}
            style={{ 
              background: 'var(--glass-bg)', 
              border: '1px solid var(--glass-border)', 
              borderRadius: '12px', 
              padding: '20px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '600', color: 'white' }}>
                {u.name?.charAt(0) || 'E'}
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{u.name || 'Unnamed'}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{u.email}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Mobile:</span>
                <span>{u.mobile || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>eKYC Status:</span>
                <span style={{ color: u.ekyc_verified ? '#10B981' : '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {u.ekyc_verified ? <><CheckCircle2 size={14}/> Verified</> : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No employees registered yet.</p>}
      </div>

      {selectedUser && (
        <EmployeeModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          token={token} 
          host={host} 
          onVerify={() => {
            fetchUsers();
            setSelectedUser({...selectedUser, ekyc_verified: true});
          }}
        />
      )}
    </div>
  );
}

function EmployeeModal({ user, onClose, token, host, onVerify }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserCases = async () => {
      try {
        const res = await fetch(`http://${host}:3000/api/admin/cases`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setCases(data.cases.filter(c => c.assigned_to_email === user.email));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUserCases();
  }, [user.email, host, token]);

  const handleVerify = async () => {
    try {
      // Create a temporary endpoint in server.js or just show a message if it doesn't exist
      alert("Verification requested for " + user.name);
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-color)', width: '90%', maxWidth: '600px', 
        borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', maxHeight: '80vh'
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Employee Details</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-color)' }}>&times;</button>
        </div>
        
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
             <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '600', color: 'white' }}>
                {user.name?.charAt(0) || 'E'}
              </div>
              <div>
                <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>{user.name || 'Unnamed'}</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{user.email}</p>
                <p style={{ color: 'var(--text-muted)' }}>Mobile: {user.mobile || 'N/A'}</p>
              </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Assigned Cases ({cases.length})</h4>
            {loading ? <p>Loading cases...</p> : (
              cases.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cases.map(c => (
                    <div key={c._id} style={{ background: 'var(--glass-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '500' }}>{c.title} (ID: {c.case_number})</span>
                      <span style={{ color: c.status === 'Pending' ? '#F59E0B' : '#10B981', fontSize: '14px' }}>{c.status}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--text-muted)' }}>No cases assigned to this employee.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
