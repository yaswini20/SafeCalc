const express = require('express');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findSafeCalcUser(phone, email, linkedUser) {
  if (linkedUser) {
    const byId = await User.findById(linkedUser).select('_id name email phone fcmToken');
    if (byId) return byId;
  }

  const normalizedPhone = String(phone || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  // Primary check: Search by phone number (exact or last 10 digits match)
  if (normalizedPhone) {
    const digits = normalizedPhone.replace(/\D/g, '');
    const phoneClauses = [{ phone: normalizedPhone }];
    if (digits.length >= 10) {
      phoneClauses.push({ phone: new RegExp(`${escapeRegex(digits.slice(-10))}$`) });
    }
    const userByPhone = await User.findOne({ $or: phoneClauses }).select('_id name email phone fcmToken');
    if (userByPhone) return userByPhone;
  }

  // Secondary check: Search by email if provided and phone lookup yielded no match
  if (normalizedEmail) {
    const userByEmail = await User.findOne({ email: normalizedEmail }).select('_id name email phone fcmToken');
    if (userByEmail) return userByEmail;
  }

  return null;
}

function shape(contact) {
  const object = contact.toObject ? contact.toObject() : contact;
  const linked = object.linkedUser && typeof object.linkedUser === 'object' ? object.linkedUser : null;
  return {
    ...object,
    linkedUser: linked ? { _id: linked._id, name: linked.name, email: linked.email, phone: linked.phone } : object.linkedUser || null,
    isSafeCalcUser: Boolean(linked || object.linkedUser),
    notificationReady: Boolean(linked?.fcmToken),
  };
}

router.get('/', protect, async (req, res) => {
  try {
    const data = await Contact.find({ user: req.user._id })
      .populate('linkedUser', 'name email phone fcmToken')
      .sort({ createdAt: 1 });
    return res.json({ success: true, count: data.length, data: data.map(shape) });
  } catch (error) {
    console.error('Load contacts error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load contacts.' });
  }
});

router.get('/registered', protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('_id name email phone fcmToken')
      .sort({ name: 1 })
      .lean();

    return res.json({
      success: true,
      data: users.map((user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        notificationReady: Boolean(user.fcmToken),
      })),
    });
  } catch (error) {
    console.error('Fetch registered users error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load registered users.' });
  }
});

router.get('/lookup', protect, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, data: [] });

    const safe = escapeRegex(q);
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: new RegExp(safe, 'i') },
        { email: new RegExp(safe, 'i') },
        { phone: new RegExp(safe, 'i') },
      ],
    }).select('_id name email phone fcmToken').limit(20);

    return res.json({
      success: true,
      data: users.map((user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        notificationReady: Boolean(user.fcmToken),
      })),
    });
  } catch (error) {
    console.error('Contact lookup error:', error);
    return res.status(500).json({ success: false, message: 'Unable to search Safe Calc users.' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { name, phone, email, relationship, linkedUser } = req.body;
    if (!name?.trim() || !phone?.trim()) return res.status(400).json({ success: false, message: 'Name and phone number are required.' });

    const user = await findSafeCalcUser(phone, email, linkedUser);
    if (!user) {
      return res.status(400).json({ success: false, message: 'This contact is not a registered Safe Calc user. Please enter a phone number of a registered account.' });
    }
    if (String(user._id) === String(req.user._id)) return res.status(400).json({ success: false, message: 'You cannot add yourself as an emergency contact.' });

    const duplicate = await Contact.findOne({ user: req.user._id, linkedUser: user._id });
    if (duplicate) return res.status(409).json({ success: false, message: 'This Safe Calc user is already an emergency contact.' });

    const contact = await Contact.create({
      user: req.user._id,
      linkedUser: user._id,
      name: name.trim() || user.name,
      phone: user.phone || phone.trim(),
      email: email?.trim() ? email.trim().toLowerCase() : (user.email || ''),
      relationship: relationship?.trim() || '',
    });

    await contact.populate('linkedUser', 'name email phone fcmToken');
    return res.status(201).json({
      success: true,
      data: shape(contact),
      message: user.fcmToken ? 'Contact added and ready for app notifications.' : 'Contact added. They need to open Safe Calc and allow notifications.',
    });
  } catch (error) {
    console.error('Create contact error:', error);
    return res.status(500).json({ success: false, message: 'Unable to create contact.' });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, user: req.user._id });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });

    const { name, phone, email, relationship, linkedUser } = req.body;
    if (!name?.trim() || !phone?.trim()) return res.status(400).json({ success: false, message: 'Name and phone number are required.' });

    const user = await findSafeCalcUser(phone, email, linkedUser);
    if (!user) return res.status(400).json({ success: false, message: 'The contact must have a registered Safe Calc account.' });
    if (String(user._id) === String(req.user._id)) return res.status(400).json({ success: false, message: 'You cannot add yourself as an emergency contact.' });

    const duplicate = await Contact.findOne({ user: req.user._id, linkedUser: user._id, _id: { $ne: contact._id } });
    if (duplicate) return res.status(409).json({ success: false, message: 'This Safe Calc user is already an emergency contact.' });

    contact.linkedUser = user._id;
    contact.name = name.trim() || user.name;
    contact.phone = user.phone || phone.trim();
    contact.email = email?.trim() ? email.trim().toLowerCase() : (user.email || '');
    contact.relationship = relationship?.trim() || '';
    await contact.save();
    await contact.populate('linkedUser', 'name email phone fcmToken');

    return res.json({ success: true, data: shape(contact) });
  } catch (error) {
    console.error('Update contact error:', error);
    return res.status(500).json({ success: false, message: 'Unable to update contact.' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });
    return res.json({ success: true, message: 'Contact removed.' });
  } catch (error) {
    console.error('Delete contact error:', error);
    return res.status(500).json({ success: false, message: 'Unable to remove contact.' });
  }
});

module.exports = router;
