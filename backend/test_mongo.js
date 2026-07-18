require('dotenv').config();
const mongoose = require('mongoose');
const { Case, User } = require('./db_models');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cases = await Case.find();
  const users = await User.find();
  console.log(JSON.stringify({cases, users}, null, 2));
  process.exit(0);
}
run().catch(console.error);
