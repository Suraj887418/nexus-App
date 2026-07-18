require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 'someid', email: 'admin@nexuscorp.com', role: 'admin' }, process.env.JWT_SECRET || 'BrainBird_Live_Production_Key_2026', { expiresIn: '1h' });

fetch('http://localhost:3000/api/admin/overview', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => res.json()).then(console.log).catch(console.error);
