const { pool } = require('./db');

async function fixDb() {
  console.log('Fixing Database Columns...');

  try {
    await pool.query('ALTER TABLE users ADD COLUMN face_descriptor LONGTEXT');
    console.log('✅ Added face_descriptor to users');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('✅ users.face_descriptor already exists');
    else console.error('❌ Failed to add face_descriptor to users:', e.message);
  }

  const attendanceCols = [
    { name: 'user_email', type: 'VARCHAR(255)' },
    { name: 'face_descriptor', type: 'LONGTEXT' },
    { name: 'device_imei', type: 'VARCHAR(255)' },
    { name: 'lat', type: 'DECIMAL(10,8)' },
    { name: 'lng', type: 'DECIMAL(11,8)' },
  ];

  for (let col of attendanceCols) {
    try {
      await pool.query(`ALTER TABLE user_attendance_v2 ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Added ${col.name} to user_attendance_v2`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log(`✅ user_attendance_v2.${col.name} already exists`);
      else console.error(`❌ Failed to add ${col.name} to user_attendance_v2:`, e.message);
    }
  }

  process.exit(0);
}

fixDb();
