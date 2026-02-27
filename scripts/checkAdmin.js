require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const mongo = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/learnsmart';
  await mongoose.connect(mongo, {});
  const u = await User.findOne({ email: 'admin@local.test' }).lean();
  console.log('found:', !!u);
  if (u) console.log({ id: u._id, email: u.email, role: u.role, passwordHash: u.password });
    const bcrypt = require('bcryptjs');
    if (u) {
      const ok = await bcrypt.compare('ChangeMe123!', u.password);
      console.log('compare default password ChangeMe123! ->', ok);
    }
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
