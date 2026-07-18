const { pool } = require('./db');

async function run() {
  try {
    await pool.query(`ALTER TABLE case_media MODIFY media_type ENUM('audio', 'video', 'document') NOT NULL`);
    console.log("Successfully altered media_type ENUM to include 'document'");
  } catch (err) {
    console.error("Error altering table:", err);
  } finally {
    process.exit(0);
  }
}

run();
