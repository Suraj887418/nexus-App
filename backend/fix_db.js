const { pool } = require('./db');
async function run() {
  try {
    // Drop the id column and add it back as AUTO_INCREMENT to fix any duplicate '0' issues cleanly
    try { await pool.query('ALTER TABLE cases DROP COLUMN id'); } catch(e) { console.log(e.message); }
    try { await pool.query('ALTER TABLE cases ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST'); } catch(e) { console.log(e.message); }
    
    // Check if the dummy case is already assigned
    const [rows] = await pool.query('SELECT * FROM cases WHERE assigned_to_email = ?', ['thakursuraj73072@gmail.com']);
    
    if (rows.length === 0) {
      await pool.query(`
        INSERT INTO cases (case_number, title, status, icon, icon_color, assigned_to_email, patient_name, hospital_name, hospital_address) 
        VALUES ('1112685270330', 'Patient Address Verification', 'Pending', 'home', '#F59E0B', 'thakursuraj73072@gmail.com', 'MINTU KUMARI', 's.s memorial hospital', 'Sector 5, Noida')
      `);
      console.log('Dummy case assigned!');
    } else {
      console.log('Dummy case already exists!');
    }
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
run();
