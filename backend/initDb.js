const { connectDB } = require('./db');
const models = require('./db_models');

async function initDatabase() {
  console.log("🛠️  Initializing Database Collections...");

  try {
    // MongoDB creates collections implicitly when inserting data, 
    // but we will insert default company settings and dummy data here.

    // Seed Company Settings
    const defaultSettings = [
      { key: 'check_in_start', val: '09:00:00', desc: 'Start time for check-in' },
      { key: 'check_in_end', val: '11:00:00', desc: 'End time for check-in' },
      { key: 'check_out_start', val: '17:00:00', desc: 'Start time for check-out' },
      { key: 'check_out_end', val: '20:00:00', desc: 'End time for check-out' },
      { key: 'hr_email', val: 'thakursuraj73072@gmail.com', desc: 'Global HR email address for notifications' }
    ];

    for (const setting of defaultSettings) {
      await models.CompanySetting.updateOne(
        { setting_key: setting.key },
        { $set: { setting_value: setting.val, description: setting.desc } },
        { upsert: true }
      );
    }

    // -- Seed Dummy Data for testing --
    const testEmail = 'admin@nexuscorp.com';

    // Insert user if not exists
    await models.User.updateOne(
      { email: testEmail },
      { $setOnInsert: { 
          name: 'Admin User', 
          mobile: '9876543210', 
          address: 'B-104, Business Park, New York', 
          password: 'password123', 
          manager_email: 'dubeyrishabh2004@gmail.com' 
        } 
      },
      { upsert: true }
    );
    
    // Also explicitly update the manager_email if user already exists
    await models.User.updateOne({ email: testEmail }, { $set: { manager_email: 'dubeyrishabh2004@gmail.com' } });

    // Check if task stats exist, if not, insert dummy stats (10 total, 7 done)
    await models.TaskStat.updateOne(
      { user_email: testEmail },
      { $setOnInsert: { total_tasks: 10, completed_tasks: 7 } },
      { upsert: true }
    );

    // Check if cases exist, if not, insert dummy cases
    const existingCases = await models.Case.find({ assigned_to_email: testEmail });
    if (existingCases.length === 0) {
      const dummyCases = [
        { case_number: '1112685270330', title: 'Patient Address Verification', status: 'Pending', icon: 'home', icon_color: '#F59E0B', assigned_to_email: testEmail, patient_name: 'MINTU KUMARI', hospital_name: 's.s memorial hospital', hospital_address: 'Sector 5, Noida', state_id: 5, city_id: 92 },
        { case_number: '1112685270082', title: 'Pathology Lab Review', status: 'Accepted', icon: 'flask', icon_color: '#10B981', assigned_to_email: testEmail, patient_name: 'Sahil', hospital_name: 'matrika hospital', hospital_address: 'Delhi Rd, Rewari', state_id: 14, city_id: 190 },
        { case_number: '1122685266404', title: 'Super Speciality Visit', status: 'Pending', icon: 'medkit', icon_color: '#3B82F6', assigned_to_email: testEmail, patient_name: 'SANJAI KUMAR SAHNI', hospital_name: 'apollomedics super speciality hospitals', hospital_address: 'Kanpur Road, Lucknow', state_id: 33, city_id: 569 }
      ];
      await models.Case.insertMany(dummyCases);
    }

    console.log("✅ Dummy data seeded successfully for", testEmail);

    // Seed Leave Balance
    await models.LeaveBalance.updateOne(
      { user_email: testEmail },
      { $setOnInsert: { annual_leave: 12, sick_leave: 4, total_annual_leave: 20, total_sick_leave: 10 } },
      { upsert: true }
    );

    // Seed Payslips
    const existingPayslips = await models.Payslip.find({ user_email: testEmail });
    if (existingPayslips.length === 0) {
      const dummyPayslips = [
        { payslip_id: 'PAY-2026-06', user_email: testEmail, month: 'June 2026', amount: '₹35,000' },
        { payslip_id: 'PAY-2026-05', user_email: testEmail, month: 'May 2026', amount: '₹35,000' }
      ];
      await models.Payslip.insertMany(dummyPayslips);
    }

    // Seed Vault History
    const existingVaults = await models.VaultHistory.find({ user_email: testEmail });
    if (existingVaults.length === 0) {
      const dummyVaults = [
        { user_email: testEmail, case_number: 'CASE-1021', type: 'video', title: 'CASE-1021 Interview', duration: '05:22' },
        { user_email: testEmail, case_number: 'CASE-1019', type: 'audio', title: 'CASE-1019 Statement', duration: '02:15' }
      ];
      await models.VaultHistory.insertMany(dummyVaults);
    }

  } catch (error) {
    console.error("❌ Error initializing database:", error);
  }
}

module.exports = { initDatabase };
