require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const User = require('../models/User');

async function run() {
  const mongo = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/learnsmart';
  await mongoose.connect(mongo, { });
  console.log('Connected to', mongo);

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@local.test';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  let user = await User.findOne({ email });
  // Upsert: if exists update password and role, otherwise create new
  if (user) {
    user.password = password; // will be hashed by pre-save
    user.role = 'admin';
    user.name = user.name || 'Administrator';
    await user.save();
    console.log('Admin updated (password reset):', { email, password });
  } else {
    user = new User({ name: 'Administrator', email, password: password, role: 'admin' });
    await user.save();
    console.log('Admin seeded:', { email, password });
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
