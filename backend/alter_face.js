const { pool } = require('./db');

async function updateDatabase() {
  try {
    const connection = await pool.getConnection();
    
    console.log('Adding face_descriptor column to users table...');
    
    // Check if column already exists
    const [rows] = await connection.query(`SHOW COLUMNS FROM users LIKE 'face_descriptor'`);
    if (rows.length === 0) {
      await connection.query(`ALTER TABLE users ADD COLUMN face_descriptor TEXT DEFAULT NULL`);
      console.log('✅ Column face_descriptor added successfully.');
    } else {
      console.log('✅ Column face_descriptor already exists.');
    }

    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
  }
}

updateDatabase();
