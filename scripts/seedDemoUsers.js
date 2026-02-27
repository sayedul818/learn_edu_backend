require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');

async function upsertUser({ name, email, password, role }) {
  let u = await User.findOne({ email });
  if (u) {
    u.name = name || u.name;
    u.password = password; // pre-save will hash
    u.role = role || u.role;
    await u.save();
    console.log(`Updated user ${email} (${role})`);
  } else {
    u = new User({ name, email, password, role });
    await u.save();
    console.log(`Created user ${email} (${role})`);
  }
}

async function run() {
  const mongo = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/learnsmart';
  await mongoose.connect(mongo, {});
  console.log('Connected to', mongo);

  const demoAccounts = [
    { name: 'Demo Student', email: 'student@demo.test', password: 'Student123!', role: 'student' },
    { name: 'Demo Teacher', email: 'teacher@demo.test', password: 'Teacher123!', role: 'teacher' },
  ];

  for (const a of demoAccounts) {
    try {
      await upsertUser(a);
    } catch (err) {
      console.error('Failed seeding', a.email, err);
    }
  }

  console.log('Demo users seeded/updated.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
