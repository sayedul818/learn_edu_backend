const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (user) => {
  const payload = { id: user._id, role: user.role, email: user.email };
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
};

const serializeUser = (userDoc) => ({
  id: userDoc._id,
  name: userDoc.name,
  email: userDoc.email,
  role: userDoc.role,
  avatar: userDoc.avatar || '',
  class: userDoc.class || '',
  group: userDoc.group || '',
  phone: userDoc.phone || '',
  status: userDoc.status,
  preferences: {
    language: userDoc.preferences?.language || 'en',
    theme: userDoc.preferences?.theme || 'system',
    notifications: {
      examReminders: userDoc.preferences?.notifications?.examReminders !== false,
      resultAlerts: userDoc.preferences?.notifications?.resultAlerts !== false,
      leaderboardUpdates: userDoc.preferences?.notifications?.leaderboardUpdates !== false,
    },
  },
  lastLogin: userDoc.lastLogin,
  createdAt: userDoc.createdAt,
  updatedAt: userDoc.updatedAt,
});

const editableProfileFields = ['name', 'email', 'phone', 'class', 'group', 'avatar'];

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'User already exists' });

    const user = new User({ name, email, password, role: role || 'student' });
    await user.save();

    const token = signToken(user);  
    res.json({ token, user: serializeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // update lastLogin
    try {
      user.lastLogin = new Date();
      await user.save();
    } catch (e) {
      console.error('Failed to update lastLogin', e);
    }

    const token = signToken(user);
    res.json({ token, user: serializeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(serializeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ data: serializeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = {};
    editableProfileFields.forEach((field) => {
      if (typeof req.body[field] !== 'undefined') updates[field] = req.body[field];
    });

    if (typeof updates.name !== 'undefined' && !String(updates.name).trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (typeof updates.email !== 'undefined') {
      const email = String(updates.email).trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });
      updates.email = email;
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    Object.entries(updates).forEach(([key, value]) => {
      user[key] = typeof value === 'string' ? value.trim() : value;
    });

    await user.save();
    res.json({ data: serializeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await user.comparePassword(String(currentPassword));
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = String(newPassword);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { language, theme, notifications } = req.body || {};

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.preferences) user.preferences = {};
    if (!user.preferences.notifications) user.preferences.notifications = {};

    if (typeof language !== 'undefined') user.preferences.language = String(language);
    if (typeof theme !== 'undefined') {
      const allowed = ['light', 'dark', 'system'];
      if (!allowed.includes(String(theme))) {
        return res.status(400).json({ error: 'Invalid theme value' });
      }
      user.preferences.theme = String(theme);
    }

    if (notifications && typeof notifications === 'object') {
      ['examReminders', 'resultAlerts', 'leaderboardUpdates'].forEach((key) => {
        if (typeof notifications[key] !== 'undefined') {
          user.preferences.notifications[key] = Boolean(notifications[key]);
        }
      });
    }

    await user.save();
    res.json({ data: serializeUser(user).preferences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
