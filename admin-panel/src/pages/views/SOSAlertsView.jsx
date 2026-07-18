import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';

export default function SOSAlertsView({ token, host }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://nexus-app-wj39.onrender.com/api/admin/sos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAlerts(data.alerts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading SOS Alerts...</p>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <AlertTriangle color="#EF4444" size={24} />
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#EF4444' }}>Emergency SOS Alerts</h2>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {alerts.map((alert) => (
          <div key={alert._id} style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#EF4444', marginBottom: '4px' }}>Active SOS</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>Triggered by: {alert.user_email}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', fontSize: '14px' }}>
                  <MapPin size={16} color="#6366f1" />
                  <span>Lat: {alert.latitude.toFixed(4)}, Lng: {alert.longitude.toFixed(4)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{new Date(alert.created_at).toLocaleString()}</span>
                <div style={{ marginTop: '8px' }}>
                  <a href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-block', textDecoration: 'none' }}>
                    View on Map
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
        {alerts.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active SOS alerts. Everyone is safe.</p>}
      </div>
    </div>
  );
}
