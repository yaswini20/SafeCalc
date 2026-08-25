const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const tokenFor = (id) => jwt.sign(
  { id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '30d' },
);

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  gender: user.gender || '',
  bloodGroup: user.bloodGroup || '',
  dob: user.dob || '',
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, mpin } = req.body;
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password || !/^\d{4}$/.test(String(mpin || ''))) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, password and a 4-digit MPIN are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must contain at least 6 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] });
    if (existing) return res.status(409).json({ success: false, message: 'An account already exists with this email or phone number.' });

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: String(password),
      mpin: String(mpin),
    });

    return res.status(201).json({ success: true, data: { ...publicUser(user), token: tokenFor(user._id) } });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Unable to create account.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await user.matchPassword(String(password)))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    return res.json({ success: true, data: { ...publicUser(user), token: tokenFor(user._id) } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Unable to sign in.' });
  }
});

router.get('/me', protect, async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});

router.put('/location', protect, async (req, res) => {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, message: 'Valid coordinates are required.' });
    }
    req.user.location = { type: 'Point', coordinates: [longitude, latitude] };
    await req.user.save();
    return res.json({ success: true });
  } catch (error) {
    console.error('Location update error:', error);
    return res.status(500).json({ success: false, message: 'Unable to update location.' });
  }
});

router.put('/fcm-token', protect, async (req, res) => {
  try {
    const fcmToken = String(req.body.fcmToken || '').trim();
    if (!fcmToken) return res.status(400).json({ success: false, message: 'FCM token is required.' });
    req.user.fcmToken = fcmToken;
    await req.user.save();
    return res.json({ success: true, message: 'Mobile notification token saved.' });
  } catch (error) {
    console.error('FCM token error:', error);
    return res.status(500).json({ success: false, message: 'Unable to save notification token.' });
  }
});

router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, gender, bloodGroup, dob } = req.body;
    if (name !== undefined) req.user.name = String(name).trim();
    if (phone !== undefined) req.user.phone = String(phone).trim();
    if (gender !== undefined) req.user.gender = String(gender);
    if (bloodGroup !== undefined) req.user.bloodGroup = String(bloodGroup);
    if (dob !== undefined) req.user.dob = String(dob);
    await req.user.save();
    return res.json({ success: true, message: 'Profile updated successfully.', data: publicUser(req.user) });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ success: false, message: 'Unable to update profile.' });
  }
});

router.put('/reset-mpin', protect, async (req, res) => {
  try {
    const password = String(req.body.password || '');
    const newMpin = String(req.body.newMpin || '');

    if (!password || !/^\d{4}$/.test(newMpin)) {
      return res.status(400).json({ success: false, message: 'Account password and a new 4-digit MPIN are required.' });
    }

    const validPassword = await req.user.matchPassword(password);
    if (!validPassword) return res.status(401).json({ success: false, message: 'Account password is incorrect.' });

    req.user.mpin = newMpin;
    await req.user.save();
    return res.json({ success: true, message: 'MPIN reset successfully.' });
  } catch (error) {
    console.error('Reset MPIN error:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset MPIN.' });
  }
});

router.put('/change-password', protect, async (req, res) => {
  try {
    const oldPassword = String(req.body.oldPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!oldPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Current password and a new password of at least 6 characters are required.' });
    }
    if (!(await req.user.matchPassword(oldPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    req.user.password = newPassword;
    await req.user.save();
    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Unable to change password.' });
  }
});

router.delete('/delete-account', protect, async (req, res) => {
  try {
    const Journey = require('../models/Journey');
    const Alert = require('../models/Alert');
    const Contact = require('../models/Contact');
    const SafePlace = require('../models/SafePlace');
    await Promise.all([
      Journey.deleteMany({ user: req.user._id }),
      Alert.deleteMany({ user: req.user._id }),
      Contact.deleteMany({ user: req.user._id }),
      SafePlace.deleteMany({ user: req.user._id }),
      Contact.deleteMany({ linkedUser: req.user._id }),
    ]);
    await req.user.deleteOne();
    return res.json({ success: true, message: 'Account deleted.' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ success: false, message: 'Unable to delete account.' });
  }
});

module.exports = router;
