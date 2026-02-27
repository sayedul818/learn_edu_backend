const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GET /api/users
exports.listUsers = async (req, res) => {
  try {
    const { search, name, email, role, status, class: classFilter, page = 1, limit = 25, sort = '-createdAt' } = req.query;
    const q = {};
    if (role) q.role = role;
    if (status) q.status = status;
    if (classFilter) q.class = classFilter;
    if (name) q.name = new RegExp(name, 'i');
    if (email) q.email = new RegExp(email, 'i');
    if (search) q.$or = [ { name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') } ];

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(limit, 10) || 25, 1);

    const [items, total] = await Promise.all([
      User.find(q).select('-password').sort(sort).skip((pageNum - 1) * perPage).limit(perPage),
      User.countDocuments(q),
    ]);

    res.json({ data: items, total, page: pageNum, limit: perPage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/users (admin)
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, class: className, group, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'User already exists' });
    const user = new User({ name, email, password, role: role || 'student', class: className, group, phone });
    await user.save();
    res.status(201).json({ data: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/users/:id (admin)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, class: className, group, phone, status } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (name) user.name = name;
    if (email) user.email = email;
    if (typeof role !== 'undefined') user.role = role;
    if (typeof className !== 'undefined') user.class = className;
    if (typeof group !== 'undefined') user.group = group;
    if (typeof phone !== 'undefined') user.phone = phone;
    if (typeof status !== 'undefined') user.status = status;
    await user.save();
    res.json({ data: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/users/:id/role
exports.changeRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Missing role' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.role = role;
    await user.save();
    res.json({ data: { id: user._id, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/users/:id/status
exports.changeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Missing status' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.status = status;
    await user.save();
    res.json({ data: { id: user._id, status: user.status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/users/:id/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Missing password' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = password; // pre-save hashes
    await user.save();
    res.json({ data: { id: user._id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Use findByIdAndDelete to avoid triggering document remove hooks
    await User.findByIdAndDelete(req.params.id);
    res.json({ data: { id: req.params.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
