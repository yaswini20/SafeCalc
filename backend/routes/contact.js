const express = require('express');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeDigitRegex(phoneOrDigits) {
  const digits = String(phoneOrDigits || '').replace(/\D/g, '');
  if (digits.length < 5) return null;
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  const pattern = last10.split('').join('[\\D]*');
  return new RegExp(pattern + '$');
}

async function findSafeCalcUser(phone, email, linkedUser) {
  if (linkedUser) {
    const byId = await User.findById(linkedUser).select('_id name email phone fcmToken');
    if (byId) return byId;
  }

  const normalizedPhone = String(phone || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  // Primary check: Exact or digit regex search by phone number
  if (normalizedPhone) {
    const regex = makeDigitRegex(normalizedPhone);
    const clauses = [{ phone: normalizedPhone }];
    if (regex) clauses.push({ phone: regex });

    const userByPhone = await User.findOne({ $or: clauses }).select('_id name email phone fcmToken');
    if (userByPhone) return userByPhone;
  }

  // Secondary check: Search by email if provided
  if (normalizedEmail) {
    const userByEmail = await User.findOne({ email: normalizedEmail }).select('_id name email phone fcmToken');
    if (userByEmail) return userByEmail;
  }

  // Fallback digit match against all user phones
  if (normalizedPhone) {
    const targetDigits = normalizedPhone.replace(/\D/g, '').slice(-10);
    if (targetDigits.length >= 7) {
      const allUsers = await User.find({}).select('_id name email phone fcmToken').lean();
      const match = allUsers.find((u) => {
        const uDigits = String(u.phone || '').replace(/\D/g, '').slice(-10);
        return uDigits.length >= 7 && uDigits === targetDigits;
      });
      if (match) return match;
    }
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
    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ success: false, message: 'Name and phone number are required.' });
    }

    const user = await findSafeCalcUser(phone, email, linkedUser);

    let contact = null;
    if (user) {
      contact = await Contact.findOne({ user: req.user._id, linkedUser: user._id });
    }
    if (!contact) {
      contact = await Contact.findOne({ user: req.user._id, phone: phone.trim() });
    }

    if (contact) {
      contact.linkedUser = user ? user._id : contact.linkedUser;
      contact.name = name.trim();
      contact.phone = phone.trim();
      contact.email = email?.trim() ? email.trim().toLowerCase() : (user?.email || contact.email || '');
      contact.relationship = relationship?.trim() || contact.relationship || '';
      await contact.save();
    } else {
      contact = await Contact.create({
        user: req.user._id,
        linkedUser: user ? user._id : null,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() ? email.trim().toLowerCase() : (user?.email || ''),
        relationship: relationship?.trim() || '',
      });
    }

    if (contact.linkedUser) {
      await contact.populate('linkedUser', 'name email phone fcmToken');
    }

    return res.status(201).json({
      success: true,
      data: shape(contact),
      message: 'Emergency contact saved successfully.',
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
    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ success: false, message: 'Name and phone number are required.' });
    }

    const user = await findSafeCalcUser(phone, email, linkedUser);

    contact.linkedUser = user ? user._id : null;
    contact.name = name.trim();
    contact.phone = phone.trim();
    contact.email = email?.trim() ? email.trim().toLowerCase() : (user?.email || '');
    contact.relationship = relationship?.trim() || '';
    await contact.save();

    if (contact.linkedUser) {
      await contact.populate('linkedUser', 'name email phone fcmToken');
    }

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
