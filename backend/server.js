const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');

const { loadModels, getFaceDescriptor, compareFaces } = require('./face_ai');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_brain_bird_key';

const { testConnection } = require('./db');
const { initDatabase } = require('./initDb');
const models = require('./db_models');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Setup for file uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const facesDir = path.join(__dirname, 'uploads', 'faces');
if (!fs.existsSync(facesDir)) {
  fs.mkdirSync(facesDir, { recursive: true });
}
// Serve static files from the uploads directory
app.use('/uploads', express.static(uploadsDir));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
  }
});
const upload = multer({ storage: storage });

const otpStore = {};
const OTP_TTL_MS = 5 * 60 * 1000;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getOtpKey(value) {
  return value.trim().toLowerCase();
}

app.get('/', (req, res) => {
  res.send('<h2>✅ Backend Server is Running Perfectly!</h2><p>The app can now connect to this server.</p>');
});

app.post('/api/check-user', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ exists: false, message: 'Mobile required' });

  try {
    const users = await models.User.find({ mobile: mobile });
    
    if (users.length > 0) {
      const user = users[0];
      const email = user.email || '';
      const emailParts = email.split('@');
      const maskedEmail = emailParts.length === 2 
        ? emailParts[0].substring(0, 2) + '****@' + emailParts[1]
        : email;
        
      res.json({
        exists: true,
        email: maskedEmail,
        rawEmail: email,
        name: user.name || 'User'
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Check User Error:', error);
    res.status(500).json({ exists: false, message: 'Server error' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, mobile, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  }

  try {
    const existingUser = await models.User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const newUser = await models.User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile?.trim() || '',
      password: password,
      manager_email: 'dubeyrishabh2004@gmail.com'
    });

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Account created successfully',
      token,
      user: { email: newUser.email, name: newUser.name }
    });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ success: false, message: 'Server error during signup' });
  }
});

// --- JWT Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access Denied: No Token Provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid Token' });
    req.user = decoded;
    next();
  });
};

// --- Production JWT APIs ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password, deviceMac, location } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Missing credentials' });

  try {
    const users = await models.User.find({ email: email.trim().toLowerCase() });

    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

    const user = users[0];

    if (user.password !== password) return res.status(401).json({ success: false, message: 'Invalid password' });

    // Generate Token
    const token = jwt.sign({ id: user.id || 0, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { email: user.email, name: user.name }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- Attendance APIs (for hr.tsx) ---
app.post('/api/check-in', async (req, res) => {
  let { email, image, lat, lng, deviceImei, deviceId, deviceMeta } = req.body;
  if (email) email = email.trim().toLowerCase();
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  if (!image) return res.status(400).json({ success: false, message: 'Face scan is required for Check-In' });
  
  try {
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' });

    const userRows = await models.User.find({ email: email });
    if (userRows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const userId = userRows[0]._id.toString();
    const registeredFaceStr = userRows[0].face_descriptor;

    let newDescriptor;
    try {
      newDescriptor = await getFaceDescriptor(image);
      if (!newDescriptor) {
        return res.status(400).json({ success: false, message: 'No face detected in the image.' });
      }
    } catch (err) {
      console.error('Face processing error:', err);
      return res.status(500).json({ success: false, message: 'Error processing face image.' });
    }

    let punchInMatchScore = null;
    let faceDescriptorStr = JSON.stringify(Array.from(newDescriptor));
    if (!registeredFaceStr) {
      await models.User.updateOne({ email: email }, { $set: { face_descriptor: faceDescriptorStr } });
      punchInMatchScore = 100.00; // 100% for first time registration
    } else {
      const registeredDescriptor = new Float32Array(JSON.parse(registeredFaceStr));
      const comparison = compareFaces(registeredDescriptor, newDescriptor);
      if (!comparison.match) {
        return res.status(403).json({ success: false, message: 'Access Denied: Face does not match registered user.' });
      }
      punchInMatchScore = Math.max(0, (1 - comparison.distance) * 100).toFixed(2);
    }

    const existing = await models.UserAttendanceV2.find({ user_email: email, attendance_date: dateStr });
    
    if (existing.length > 0) {
      if (!existing[0].punch_out_time) {
        return res.status(400).json({ success: false, message: 'Already checked in today' });
      } else {
        return res.status(400).json({ success: false, message: 'Already checked in and checked out today' });
      }
    }

    let selfiePath = null;
    if (image) {
      try {
        const fs = require('fs');
        const path = require('path');
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const filename = `punch_in_${userId}_${Date.now()}.jpg`;
        const filepath = path.join(__dirname, 'uploads', 'faces', filename);
        fs.writeFileSync(filepath, base64Data, 'base64');
        selfiePath = `http://122.162.237.44:3000/uploads/faces/${filename}`;
      } catch (fsErr) {
        console.error('Error saving selfie:', fsErr);
      }
    }

    await models.UserAttendanceV2.create({
      user_email: email,
      user_id: userId,
      attendance_date: dateStr,
      punch_in_time: new Date(),
      status: 'Present',
      lat: lat || null,
      lng: lng || null,
      device_imei: deviceImei || null,
      face_descriptor: faceDescriptorStr
    });

    res.json({ success: true, message: 'Checked in successfully', checkInTime: timeStr });
  } catch (err) {
    console.error("Check-In Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/check-out', async (req, res) => {
  const { email, lat, lng } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  
  try {
    const dateStr = new Date().toISOString().split('T')[0];

    const existing = await models.UserAttendanceV2.find({ user_email: email, attendance_date: dateStr });
    
    if (existing.length === 0) {
      return res.status(400).json({ success: false, message: 'You have not checked in today' });
    }
    
    if (existing[0].punch_out_time) {
      return res.status(400).json({ success: false, message: 'Already checked out today' });
    }

    await models.UserAttendanceV2.updateOne(
      { user_email: email, attendance_date: dateStr },
      { $set: { punch_out_time: new Date(), lat: lat || null, lng: lng || null } }
    );

    res.json({ success: true, message: 'Checked out successfully' });
  } catch (err) {
    console.error("Check-Out Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/attendance', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  
  try {
    const records = await models.UserAttendanceV2.find({ user_email: email })
      .sort({ attendance_date: -1 })
      .limit(30);
    
    const formattedRecords = records.map(r => {
      // Format times to HH:MM format
      let inTime = null;
      let outTime = null;
      if (r.punch_in_time) {
        const d = new Date(r.punch_in_time);
        inTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      if (r.punch_out_time) {
        const d = new Date(r.punch_out_time);
        outTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      
      return {
        date: r.attendance_date + 'T00:00:00.000Z',
        check_in_time: inTime,
        check_out_time: outTime,
        status: r.status || 'Present'
      };
    });

    res.json({ success: true, attendance: formattedRecords });
  } catch (err) {
    console.error("Fetch Attendance Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/fo/mark-attendance', authenticateToken, async (req, res) => {
  if (req.headers['x-app-source'] !== 'mobile') {
    return res.status(403).json({ success: false, message: 'Strictly restricted to mobile' });
  }
  const { action, device_imei, lat, lng, address, face_descriptor } = req.body;

  try {
    const dateStr = new Date().toISOString().split('T')[0];
    const faceDataStr = face_descriptor ? JSON.stringify(face_descriptor) : null;

    await models.UserAttendanceV2.create({
      user_id: req.user.id || '0',
      attendance_date: dateStr,
      punch_in_time: new Date(),
      status: 'PRESENT',
      device_imei, lat, lng, face_descriptor: faceDataStr
    });

    res.json({ success: true, message: 'Attendance punched successfully with biometric matrix' });
  } catch (error) {
    console.error("Attendance Error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/fo/my-cases', authenticateToken, async (req, res) => {
  if (req.headers['x-app-source'] !== 'mobile') {
    return res.status(403).json({ success: false, message: 'Strictly restricted to mobile' });
  }
  try {
    const cases = await models.Case.find({ assigned_to_email: req.user.email });
    res.json({ success: true, cases });
  } catch (error) {
    console.error("Fetch Cases Error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/cases/submit-case', authenticateToken, async (req, res) => {
  const {
    is_rework, insurance_id, type_id, sub_type_id, claim_number, allocation_date,
    patient_name, patient_mobile, patient_address, patient_state_id, patient_city_id,
    patient_pin_code, diagnosis, trigger_reason, hospital_name, hospital_address,
    state_id, city_id, pin_code, am_id, alm_id, is_single_fo, master_fo,
    map_questions, initial_documents
  } = req.body;

  try {
    await models.Case.create({
      is_rework, insurance_id, type_id, sub_type_id, case_number: claim_number, allocation_date,
      patient_name, patient_mobile, patient_address, patient_state_id, patient_city_id,
      patient_pin_code, diagnosis, trigger_reason, hospital_name, hospital_address,
      state_id, city_id, pin_code, am_id, alm_id, is_single_fo, master_fo,
      map_questions, initial_documents, status: 'Pending', assigned_to_email: req.user.email
    });
    res.json({ success: true, message: 'Case allocated successfully to master grid.' });
  } catch (error) {
    console.error("Submit Case Error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- Profile APIs ---
app.get('/api/profile', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    const users = await models.User.find({ email: email });
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, profile: users[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/profile', async (req, res) => {
  const { email, name, mobile, address, newPassword } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    const updateData = {};
    if (name) updateData.name = name;
    if (mobile) updateData.mobile = mobile;
    if (address) updateData.address = address;
    if (newPassword) updateData.password = newPassword;
    
    if (Object.keys(updateData).length > 0) {
      await models.User.updateOne({ email: email }, { $set: updateData });
    }
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/ekyc/verify', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    await models.User.updateOne({ email: email }, { $set: { ekyc_verified: true } });
    res.json({ success: true, message: 'eKYC Verified' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- Dashboard APIs ---
app.get('/api/dashboard-stats', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });

  try {
    const statsArray = await models.TaskStat.find({ user_email: email });
    const stats = statsArray[0] || { total_tasks: 0, completed_tasks: 0 };

    const today = new Date().toISOString().split('T')[0];
    const userRows = await models.User.find({ email: email }).limit(1);
    let attRes = [];
    if (userRows.length > 0) {
      const userId = userRows[0]._id.toString();
      attRes = await models.UserAttendanceV2.find({ user_id: userId, attendance_date: today, deleted_at: null })
        .sort({ punch_in_time: -1 })
        .limit(1);
    }

    res.json({
      success: true,
      totalTasks: stats.total_tasks,
      completedTasks: stats.completed_tasks,
      checkedIn: attRes.length > 0,
      checkInTime: attRes.length > 0 ? attRes[0].punch_in_time : null
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/cases/pending', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });

  try {
    const cases = await models.Case.find({ assigned_to_email: email, status: 'Pending' });
    res.json({ success: true, cases });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/cases', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });

  try {
    const cases = await models.Case.find({ assigned_to_email: email });
    res.json({ success: true, cases });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/cases/status', async (req, res) => {
  const { email, caseNumber, status } = req.body;
  if (!email || !caseNumber || !status) return res.status(400).json({ success: false, message: 'Missing required fields' });

  try {
    await models.Case.updateMany(
      { case_number: caseNumber, assigned_to_email: email },
      { $set: { status: status } }
    );

    await models.CaseStatusHistory.create({
      case_number: caseNumber,
      user_email: email,
      status: status
    });

    res.json({ success: true, message: `Case ${status} successfully` });
  } catch (err) {
    console.error("Case Status Error:", err);
    res.status(500).json({ success: false, message: 'Server error while updating status' });
  }
});

app.get('/api/settings/attendance', async (req, res) => {
  try {
    const settings = await models.CompanySetting.find({});
    const result = {};
    settings.forEach(s => result[s.setting_key] = s.setting_value);
    res.json({ success: true, settings: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/check-in', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });

  try {
    // Validate Admin Timings
    const settingsArray = await models.CompanySetting.find({});
    let checkInStart = '09:00:00';
    let checkInEnd = '11:00:00';
    settingsArray.forEach(s => {
      if (s.setting_key === 'check_in_start') checkInStart = s.setting_value;
      if (s.setting_key === 'check_in_end') checkInEnd = s.setting_value;
    });

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Fetch user_id from users table
    const userRows = await models.User.find({ email: email });
    if (userRows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const userId = userRows[0]._id.toString();

    // Check existing entry in user_attendance_v2
    const existing = await models.UserAttendanceV2.find({ user_id: userId, attendance_date: dateStr, deleted_at: null });
    if (existing.length > 0) {
      return res.json({ success: false, message: 'Already checked in today' });
    }

    // Insert into official user_attendance_v2 table with NULLs for location and selfie
    await models.UserAttendanceV2.create({
      user_id: userId,
      user_email: email,
      attendance_date: dateStr,
      punch_in_time: new Date(),
      status: 'PRESENT'
    });
    res.json({ success: true, checkInTime: timeStr });
  } catch (err) {
    console.error("Check-in Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const users = await models.User.find({ email: req.user.email });
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, profile: users[0] });
  } catch (err) {
    console.error("Profile GET Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { name, mobile, address } = req.body;
    await models.User.updateOne(
      { email: req.user.email },
      { $set: { name, mobile, address } }
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error("Profile POST Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/profile/verify-ekyc', authenticateToken, async (req, res) => {
  try {
    await models.User.updateOne({ email: req.user.email }, { $set: { ekyc_verified: true } });
    res.json({ success: true, message: 'eKYC verified successfully' });
  } catch (err) {
    console.error("eKYC Error:", err);
    res.status(500).json({ success: false, message: 'Failed to verify eKYC' });
  }
});


app.post('/api/face-auth', async (req, res) => {
  let { email, image } = req.body;
  if (email) email = email.trim().toLowerCase();
  console.log('FACE AUTH ATTEMPT FOR EMAIL:', JSON.stringify(email));
  if (!email || !image) {
    return res.status(400).json({ success: false, message: 'Email and image data are required' });
  }

  try {
    const userRows = await models.User.find({ email: email });
    if (userRows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    
    const userId = userRows[0]._id.toString();
    const registeredFaceStr = userRows[0].face_descriptor;

    let newDescriptor;
    try {
      // Strip data URI if present (though getFaceDescriptor handles clean base64 better)
      const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");
      // Re-add prefix for face_ai format
      const dataUri = `data:image/jpeg;base64,${cleanBase64}`;
      newDescriptor = await getFaceDescriptor(dataUri);
      
      if (!newDescriptor) {
        return res.status(400).json({ success: false, message: 'No face detected in the image.' });
      }
    } catch (err) {
      console.error('Face processing error:', err);
      return res.status(500).json({ success: false, message: 'Error processing face image.' });
    }

    if (!registeredFaceStr) {
      // First time registration
      await models.User.updateOne({ email: email }, { $set: { face_descriptor: JSON.stringify(Array.from(newDescriptor)) } });
      console.log(`✅ Face registered successfully for user: ${email}`);
      return res.json({ success: true, message: 'Face registered successfully' });
    } else {
      // Returning user - verify strict face match
      const registeredDescriptor = new Float32Array(JSON.parse(registeredFaceStr));
      const comparison = compareFaces(registeredDescriptor, newDescriptor);
      
      if (!comparison.match) {
        console.log(`❌ Face mismatch for user: ${email} (Distance: ${comparison.distance})`);
        return res.status(403).json({ success: false, message: 'Access Denied: Face does not match registered user.' });
      }

      console.log(`✅ Face verified successfully for user: ${email}`);
      return res.json({ success: true, message: 'Face verified successfully' });
    }
  } catch (err) {
    console.error("Face Auth Error:", err);
    res.status(500).json({ success: false, message: 'Server error during face verification' });
  }
});

app.post('/api/upload-media', upload.single('file'), async (req, res) => {
  const { caseNumber, sectionId, mediaType, cameraType } = req.body;
  const file = req.file;

  if (!file || !caseNumber) {
    return res.status(400).json({ success: false, message: 'Missing file or case number' });
  }

  try {
    const filePath = `${req.protocol}://${req.get('host')}/${file.path.replace(/\\/g, '/')}`;

    await models.CaseMedia.create({
      case_number: caseNumber,
      section_id: sectionId || 'unknown',
      media_type: mediaType || 'document',
      camera_type: cameraType || 'none',
      file_path: filePath
    });

    res.json({ success: true, message: 'Media uploaded successfully', documentUrl: filePath });
  } catch (error) {
    console.error("Upload Media Error:", error);
    res.status(500).json({ success: false, message: 'Server error while saving media' });
  }
});

app.post('/api/mrd-charges', upload.single('file'), async (req, res) => {
  const { claimNo, customerName, hospitalName, state, district, latitude, longitude } = req.body;
  const file = req.file;

  if (!claimNo || !customerName || !hospitalName) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {

    let filePath = null;
    let filePath2 = null;

    if (file) {
      const fs = require('fs');
      const path = require('path');
      
      const ext = path.extname(file.originalname);
      const newFilename = `${file.filename}_user_copy${ext}`;
      const newFilePath = path.join(file.destination, newFilename);
      
      // Create the second copy
      fs.copyFileSync(file.path, newFilePath);
      
      filePath = `http://122.162.237.44:3000/${file.path.replace(/\\/g, '/')}`;
      filePath2 = `http://122.162.237.44:3000/${newFilePath.replace(/\\/g, '/')}`;
    }

    await models.MrdCharge.create({
      claim_no: claimNo, customer_name: customerName, hospital_name: hospitalName, 
      state, district, file_path: filePath, file_path_2: filePath2, 
      latitude: latitude || null, longitude: longitude || null
    });
    res.json({ success: true, message: 'MRD Charges submitted successfully', documentUrl: filePath2 || filePath });
  } catch (err) {
    console.error("MRD Charges Error:", err);
    res.status(500).json({ success: false, message: 'Server error while saving MRD charges' });
  }
});

app.get('/api/payslips', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    const payslips = await models.Payslip.find({ user_email: email });
    const formattedPayslips = payslips.map(p => ({ id: p.payslip_id, month: p.month, amount: p.amount }));
    res.json({ success: true, payslips: formattedPayslips });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/payslips/download', (req, res) => {
  const { email, payslipId } = req.body;
  if (!email || !payslipId) return res.status(400).json({ success: false, message: 'Missing fields' });

  // Simulate download delay
  setTimeout(() => {
    res.json({ success: true, message: 'Payslip generated successfully' });
  }, 1000);
});

app.get('/api/leave/balance', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    const balances = await models.LeaveBalance.find({ user_email: email });
    let balance = balances[0] || { annual_leave: 0, sick_leave: 0, total_annual_leave: 20, total_sick_leave: 10 };
    
    // Fetch dynamic leave history
    const historyRows = await models.LeaveApplication.find({ user_email: email }).sort({ _id: -1 });
    
    balance = balance.toObject ? balance.toObject() : balance;
    balance.leave_history = historyRows.map(h => ({
      id: h._id, type: h.leave_type, startDate: h.start_date, endDate: h.end_date, status: h.status
    }));

    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

app.post('/api/leave/apply', async (req, res) => {
  const { email, leaveType, startDate, endDate, leaveMessage } = req.body;
  if (!email || !leaveType || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  try {
    await models.LeaveApplication.create({
      user_email: email, leave_type: leaveType, start_date: startDate, end_date: endDate
    });

    const user = await models.User.findOne({ email });
    const userName = user ? user.name : email;
    const adminEmail = 'thakursuraj73072@gmail.com';
    const hrEmail = 'thakursuraj73072@gmail.com';

    const mailOptions = {
      from: process.env.SMTP_USER || 'no-reply@nexuscorp.com',
      to: 'thakursuraj73072@gmail.com',
      subject: `Leave Application - ${userName} (${leaveType})`,
      text: `Hello,\n\nA new leave application has been submitted by ${userName} (${email}).\n\nLeave Type: ${leaveType}\nDuration: ${startDate} to ${endDate}\n\nMessage / Reason:\n${leaveMessage || 'No message provided'}\n\nPlease review the application.\n\nThank you.`
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error('Error sending leave email:', error);
        else console.log('Leave email sent:', info.response);
      });
    } else {
      console.log('SMTP credentials not found in .env. Skipping email sending.');
    }

    res.json({ success: true, message: 'Leave application submitted successfully' });
  } catch (err) {
    console.error('Leave apply error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/avr/sync', async (req, res) => {
  const { email, caseNumber, type, title, duration } = req.body;
  try {
    await models.VaultHistory.create({
      user_email: email, case_number: caseNumber, type, title, duration
    });
    res.json({ success: true, message: 'Vault synced' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/avr/history', async (req, res) => {
  const email = req.query.email;
  try {
    const history = await models.VaultHistory.find({ user_email: email }).sort({ created_at: -1 });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/sos', async (req, res) => {
  const { email, latitude, longitude } = req.body;
  if (!email || !latitude || !longitude) {
    return res.status(400).json({ success: false, message: 'Email and location are required' });
  }
  try {
    await models.SosAlert.create({
      user_email: email, latitude, longitude
    });
    res.json({ success: true, message: 'SOS signal and location sent to HQ successfully.' });
  } catch (err) {
    console.error("SOS Error:", err);
    res.status(500).json({ success: false, message: 'Server error while sending SOS' });
  }
});

app.post('/api/save-token', async (req, res) => {
  const { email, pushToken } = req.body;
  if (!email || !pushToken) {
    return res.status(400).json({ success: false, message: 'Email and push token are required' });
  }
  try {
    await models.User.updateOne({ email: email }, { $set: { push_token: pushToken } });
    res.json({ success: true, message: 'Push notification token saved successfully' });
  } catch (err) {
    console.error("Save Token Error:", err);
    res.status(500).json({ success: false, message: 'Server error while saving token' });
  }
});
// --- ADMIN PANEL APIs ---
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin@123') {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }
});

const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Not admin');
    next();
  } catch (e) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

app.get('/api/admin/cases', adminAuth, async (req, res) => {
  try {
    const cases = await models.Case.find().sort({ created_at: -1 });
    res.json({ success: true, cases });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching cases' });
  }
});

app.post('/api/admin/cases', adminAuth, async (req, res) => {
  try {
    const newCase = await models.Case.create(req.body);
    res.json({ success: true, case: newCase });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating case' });
  }
});

app.post('/api/admin/assign-case', adminAuth, async (req, res) => {
  try {
    let { case_number, assigned_to_email } = req.body;
    if (assigned_to_email) assigned_to_email = assigned_to_email.trim().toLowerCase();
    await models.Case.updateOne({ case_number }, { $set: { assigned_to_email, status: 'Pending' } });
    res.json({ success: true, message: 'Case assigned successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error assigning case' });
  }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await models.User.find().select('-password').sort({ created_at: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

app.get('/api/admin/overview', adminAuth, async (req, res) => {
  try {
    const totalUsers = await models.User.countDocuments();
    const totalCases = await models.Case.countDocuments();
    const pendingLeaves = await models.LeaveApplication.countDocuments({ status: 'Pending' });
    const activeSos = await models.SosAlert.countDocuments({ status: 'Active' });
    res.json({ success: true, stats: { totalUsers, totalCases, pendingLeaves, activeSos } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching overview' });
  }
});

app.get('/api/admin/attendance', adminAuth, async (req, res) => {
  try {
    const attendance = await models.UserAttendanceV2.find().sort({ punch_in_time: -1 }).limit(100);
    res.json({ success: true, attendance });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching attendance' });
  }
});

app.get('/api/admin/sos', adminAuth, async (req, res) => {
  try {
    const alerts = await models.SosAlert.find().sort({ created_at: -1 }).limit(50);
    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching SOS alerts' });
  }
});

app.get('/api/admin/leaves', adminAuth, async (req, res) => {
  try {
    const leaves = await models.LeaveApplication.find().sort({ created_at: -1 });
    res.json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching leaves' });
  }
});

app.post('/api/admin/leaves/update', adminAuth, async (req, res) => {
  try {
    const { id, status } = req.body;
    await models.LeaveApplication.findByIdAndUpdate(id, { status });
    res.json({ success: true, message: `Leave ${status} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating leave' });
  }
});

// AI Chat Endpoint
app.post('/api/ai/chat', async (req, res) => {
  const { message, email } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      const msg = message.toLowerCase();
      let userName = email || "Employee";
      if (email) {
        const user = await models.User.findOne({ email });
        if (user) userName = user.name;
      }
      
      let reply = "";
      if (msg.includes("leave") || msg.includes("balance") || msg.includes("chutti")) {
        const balances = await models.LeaveBalance.findOne({ user_email: email });
        if (balances) {
          reply = `You currently have **${balances.annual_leave} Annual Leaves** and **${balances.sick_leave} Sick Leaves** remaining.`;
        } else {
          reply = "I couldn't find your leave balance in the system.";
        }
      } else if (msg.includes("case") || msg.includes("hospital") || msg.includes("kam")) {
        reply = "You can view your assigned cases and hospital details on your Dashboard. The map also provides the shortest route to your destinations.";
      } else if (msg.includes("hello") || msg.includes("hi") || msg.includes("kaise")) {
        reply = `Hello ${userName}! I am Nexus AI. I can assist you with your leaves, cases, and app-related queries. How can I help you today?`;
      } else if (msg.includes("admin") || msg.includes("hr")) {
        reply = "You can contact HR and Admin at admin@nexuscorp.com and hr@nexuscorp.com. Leave applications are directly forwarded to them.";
      } else {
        reply = "I am currently running in Basic Offline Mode. I can answer questions about your leave balance, cases, and HR contacts. For advanced AI features, an API key is required.";
      }
      return res.json({ success: true, reply });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    let userName = email || "Employee";
    if (email) {
      const user = await models.User.findOne({ email });
      if (user) userName = user.name;
    }

    const systemInstruction = `You are Nexus AI Assistant, an internal HR and support bot for Nexus Corp.
The user you are talking to is: ${userName}.
Keep your responses professional, helpful, concise, and friendly.
Format your responses using clean markdown if necessary.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    res.json({ success: true, reply: response.text });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ success: false, message: 'Error communicating with AI.' });
  }
});

async function startServer() {
  const connected = await testConnection();

  if (!connected) {
    console.log("❌ Database Connection Failed");
    process.exit(1);
  }

  try { await loadModels(); } catch(e) { console.log("Failed to load AI Models"); }
  await initDatabase();

  app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Backend server running at http://0.0.0.0:${port}`);
    console.log("✅ Ready for requests");
  });
}

startServer();
