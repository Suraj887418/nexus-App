const { pool } = require('./db');

async function run() {
  try {
    const [maxIdRows] = await pool.query('SELECT MAX(id) as maxId FROM cases');
    const nextId = (maxIdRows[0].maxId || 0) + 1;
    
    // Using a new random case number to ensure it's completely fresh
    const newCaseNumber = 'CASE-' + Date.now().toString().slice(-6);

    await pool.query(`
      INSERT INTO cases (id, case_number, title, status, icon, icon_color, assigned_to_email, patient_name, hospital_name, hospital_address) 
      VALUES (?, ?, 'Super Speciality Visit', 'Pending', 'medkit', '#3B82F6', 'thakursuraj73072@gmail.com', 'SANJAI KUMAR SAHNI', 'apollomedics super speciality hospitals', 'Kanpur Road, Lucknow')
    `, [nextId, newCaseNumber]);
    
    console.log('Brand new dummy case assigned with Case Number: ' + newCaseNumber);
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
run();
