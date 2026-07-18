require('dotenv').config();
const mongoose = require('mongoose');
const models = require('./db_models');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const totalUsers = await models.User.countDocuments();
    const totalCases = await models.Case.countDocuments();
    const pendingLeaves = await models.LeaveApplication.countDocuments({ status: 'Pending' });
    const activeSos = await models.SosAlert.countDocuments({ status: 'Active' });
    console.log(JSON.stringify({ totalUsers, totalCases, pendingLeaves, activeSos }));
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run().catch(console.error);
