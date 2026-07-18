const { pool } = require('./db');
async function run() {
  try {
    // Add columns if they don't exist
    await pool.query('ALTER TABLE mrd_charges ADD COLUMN latitude DECIMAL(10,8)');
    await pool.query('ALTER TABLE mrd_charges ADD COLUMN longitude DECIMAL(11,8)');
    console.log('Columns latitude and longitude added to mrd_charges');
    process.exit(0);
  } catch(err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist');
      process.exit(0);
    }
    console.error(err);
    process.exit(1);
  }
}
run();
