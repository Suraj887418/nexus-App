const { pool } = require('./db');
async function run() {
  try {
    const [rows] = await pool.query('SELECT * FROM cases WHERE case_number = ?', ['1112685270082']);
    
    if (rows.length === 0) {
      await pool.query(`
        INSERT INTO cases (case_number, title, status, icon, icon_color, assigned_to_email, patient_name, hospital_name, hospital_address) 
        VALUES ('1112685270082', 'Pathology Lab Review', 'Pending', 'flask', '#10B981', 'thakursuraj73072@gmail.com', 'Sahil', 'matrika hospital', 'Delhi Rd, Rewari')
      `);
      console.log('Second dummy case assigned!');
    } else {
      console.log('Second dummy case already exists!');
    }
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
run();
