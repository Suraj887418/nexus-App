import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

export default function CasesView({ token, host }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [newCase, setNewCase] = useState({ title: '', case_number: '', patient_name: '', hospital_name: '', assigned_to_email: '' });

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://nexus-app-wj39.onrender.com/api/admin/cases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setCases(data.cases);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (caseNumber, email) => {
    if (!email) return;
    try {
      const res = await fetch(`https://nexus-app-wj39.onrender.com/api/admin/assign-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ case_number: caseNumber, assigned_to_email: email })
      });
      const data = await res.json();
      if (data.success) {
        alert("Case assigned successfully!");
        fetchCases();
      }
    } catch (e) {
      alert("Failed to assign case");
    }
  };

  const handleAddCase = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://nexus-app-wj39.onrender.com/api/admin/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newCase)
      });
      const data = await res.json();
      if (data.success) {
        alert("Case created successfully!");
        setShowAddForm(false);
        setNewCase({ title: '', case_number: '', patient_name: '', hospital_name: '', assigned_to_email: '' });
        fetchCases();
      }
    } catch (e) {
      alert("Failed to create case");
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading cases...</p>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Manage Cases</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>
          <Plus size={16} /> Add New Case
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddCase} style={{ background: 'var(--glass-bg)', padding: '20px', borderRadius: '12px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Create New Case</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input className="input-field" placeholder="Case Number (Unique)" required value={newCase.case_number} onChange={e => setNewCase({...newCase, case_number: e.target.value})} />
            <input className="input-field" placeholder="Case Title" required value={newCase.title} onChange={e => setNewCase({...newCase, title: e.target.value})} />
            <input className="input-field" placeholder="Patient Name" value={newCase.patient_name} onChange={e => setNewCase({...newCase, patient_name: e.target.value})} />
            <input className="input-field" placeholder="Hospital Name" value={newCase.hospital_name} onChange={e => setNewCase({...newCase, hospital_name: e.target.value})} />
            <input className="input-field" placeholder="Assign to Email (Optional)" value={newCase.assigned_to_email} onChange={e => setNewCase({...newCase, assigned_to_email: e.target.value})} />
          </div>
          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '14px' }}>Submit Case</button>
        </form>
      )}

      <div style={{ display: 'grid', gap: '16px' }}>
        {cases.map((c) => (
          <div 
            key={c._id} 
            onClick={(e) => {
              if(e.target.tagName !== 'INPUT') setSelectedCase(c);
            }}
            style={{ 
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>{c.title}</h3>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', display: 'flex', gap: '16px' }}>
                <span>Case ID: {c.case_number}</span>
                <span>Patient: {c.patient_name || 'N/A'}</span>
                <span>Status: <span style={{ color: c.status === 'Pending' ? '#F59E0B' : '#10B981' }}>{c.status}</span></span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Assigned to:</span>
              <input 
                type="text" 
                className="input-field" 
                style={{ width: '200px', padding: '8px 12px' }}
                placeholder="Employee Email"
                defaultValue={c.assigned_to_email || ''}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  if(e.target.value !== c.assigned_to_email) {
                    handleAssign(c.case_number, e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if(e.key === 'Enter') {
                    if(e.target.value !== c.assigned_to_email) {
                      handleAssign(c.case_number, e.target.value);
                    }
                    e.target.blur();
                  }
                }}
              />
            </div>
          </div>
        ))}
        {cases.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No cases found in the database.</p>}
      </div>

      {selectedCase && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedCase(null)}>
          <div style={{ background: '#FFF', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px', color: '#1F2937' }}>Case Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p><strong>Title:</strong> {selectedCase.title}</p>
              <p><strong>Case Number:</strong> {selectedCase.case_number}</p>
              <p><strong>Patient Name:</strong> {selectedCase.patient_name || 'N/A'}</p>
              <p><strong>Hospital Name:</strong> {selectedCase.hospital_name || 'N/A'}</p>
              <p><strong>Status:</strong> <span style={{ color: selectedCase.status === 'Pending' ? '#F59E0B' : '#10B981', fontWeight: '600' }}>{selectedCase.status}</span></p>
              <p><strong>Assigned To:</strong> {selectedCase.assigned_to_email || 'Unassigned'}</p>
              <p><strong>Created At:</strong> {new Date(selectedCase.created_at).toLocaleString()}</p>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedCase(null)} className="btn-primary" style={{ padding: '10px 20px', background: '#64748B' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
