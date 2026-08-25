const express = require('express');
const fs = require('fs');
const path = require('path');
const Alert = require('../models/Alert');
const Journey = require('../models/Journey');
const Contact = require('../models/Contact');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const {
  sendEmergencyNotifications,
  sendSosResolvedNotification,
} = require('../utils/notification');

const router = express.Router();

/**
 * Broadcast SOS through Socket.IO with strict room isolation.
 * Sends ONLY to the victim user room and their confirmed linked emergency contacts.
 */
async function broadcastSos(req, alert, journey) {
  const io = req.app.get('io');
  const contacts = await Contact.find({ user: alert.user })
    .populate('linkedUser', '_id name phone email fcmToken')
    .lean();

  const user = await User.findById(alert.user)
    .select('_id name phone email')
    .lean();

  if (io && user) {
    const payload = {
      alertId: String(alert._id),
      userId: String(user._id),
      user: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        email: user.email,
      },
      journey: journey
        ? {
            id: String(journey._id),
            destinationName: journey.destinationName,
            travelMode: journey.travelMode,
            vehicleNumber: journey.vehicleNumber,
          }
        : null,
      latitude: alert.latitude,
      longitude: alert.longitude,
      triggerType: alert.triggerType || 'manual_sos',
      contacts: contacts.map((contact) => ({
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        isSafeCalcUser: Boolean(contact.linkedUser),
        notificationReady: Boolean(contact.linkedUser?.fcmToken),
      })),
      createdAt: alert.createdAt,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${alert.latitude},${alert.longitude}`,
    };

    // User room
    const recipientIds = new Set([String(alert.user)]);

    // Linked emergency contact rooms
    contacts.forEach((contact) => {
      if (contact.linkedUser?._id) {
        recipientIds.add(String(contact.linkedUser._id));
      }
    });

    recipientIds.forEach((roomId) => {
      io.to(roomId).emit('sos_triggered', payload);
      // Support mobile client legacy event name
      io.to(roomId).emit('nearby_sos_alert', payload);
    });
  }

  return contacts;
}

/**
 * TRIGGER SOS
 */
router.post('/trigger', protect, async (req, res) => {
  try {
    const { latitude, longitude, triggerType = 'manual_sos' } = req.body;
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        success: false,
        message: 'Valid GPS coordinates are required.',
      });
    }

    // Check if an SOS alert is already active for this user
    const existing = await Alert.findOne({
      user: req.user._id,
      status: 'active',
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An SOS alert is already active. Resolve it with your MPIN first.',
        data: existing,
      });
    }

    // Find and update active journey status if one exists
    let journey = await Journey.findOne({
      user: req.user._id,
      status: {
        $in: ['active', 'grace_period', 'check_in_requested', 'sos_triggered'],
      },
    });

    if (journey && journey.status !== 'sos_triggered') {
      journey.status = 'sos_triggered';
      await journey.save();
    }

    // Create the active SOS alert
    const alert = await Alert.create({
      user: req.user._id,
      journey: journey ? journey._id : undefined,
      latitude: lat,
      longitude: lon,
      triggerType,
      status: 'active',
    });

    // Broadcast in real-time to user and designated guardian contact rooms
    const contacts = await broadcastSos(req, alert, journey);

    // Send push notifications asynchronously
    sendEmergencyNotifications(req.user, alert, contacts).catch((error) =>
      console.error('SOS push notification error:', error.message)
    );

    return res.status(201).json({
      success: true,
      message: 'SOS alert triggered successfully.',
      data: alert,
    });
  } catch (error) {
    console.error('SOS trigger error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to trigger SOS.',
    });
  }
});

/**
 * RESOLVE SOS
 */
router.post('/resolve', protect, async (req, res) => {
  try {
    const mpin = String(req.body?.mpin || '').trim();

    if (!/^\d{4}$/.test(mpin)) {
      return res.status(400).json({
        success: false,
        message: 'A 4-digit MPIN is required.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const valid = await user.matchMPIN(mpin);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect MPIN. SOS is still active.',
      });
    }

    const activeAlerts = await Alert.find({
      user: user._id,
      status: 'active',
    });

    if (!activeAlerts.length) {
      return res.status(404).json({
        success: false,
        message: 'No active SOS alert found.',
      });
    }

    const now = new Date();
    const primaryAlert = activeAlerts[0];

    // Mark ALL active alerts for this user as resolved
    await Alert.updateMany(
      { user: user._id, status: 'active' },
      { $set: { status: 'resolved', resolvedAt: now } }
    );

    // Revert any sos_triggered journeys back to active so the user can continue travel safely
    await Journey.updateMany(
      {
        user: user._id,
        status: 'sos_triggered',
      },
      { $set: { status: 'active' } }
    );

    // Notify emergency contacts via push notification
    const contacts = await Contact.find({ user: user._id })
      .populate('linkedUser', '_id name fcmToken')
      .lean();

    sendSosResolvedNotification(user, primaryAlert, contacts).catch((error) =>
      console.error('Resolve push notification error:', error.message)
    );

    // Broadcast resolve event to user and contact rooms
    const io = req.app.get('io');
    if (io) {
      const resolvePayload = {
        alertId: String(primaryAlert._id),
        userId: String(user._id),
      };

      const recipientIds = new Set([String(user._id)]);
      contacts.forEach((contact) => {
        if (contact.linkedUser?._id) {
          recipientIds.add(String(contact.linkedUser._id));
        }
      });

      recipientIds.forEach((roomId) => {
        io.to(roomId).emit('sos_resolved', resolvePayload);
      });
    }

    return res.json({
      success: true,
      message: 'SOS resolved successfully. You are marked safe.',
      data: primaryAlert,
    });
  } catch (error) {
    console.error('SOS resolve error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to resolve SOS.',
    });
  }
});

/**
 * ACTIVE ALERTS
 * Returns active alerts belonging to the user or from people who added the user as an emergency contact.
 */
router.get('/active', protect, async (req, res) => {
  try {
    // Find contacts where this user is the guardian
    const guardianOf = await Contact.find({ linkedUser: req.user._id })
      .select('user')
      .lean();
    const guardianUserIds = guardianOf.map((c) => c.user);

    const data = await Alert.find({
      status: 'active',
      $or: [{ user: req.user._id }, { user: { $in: guardianUserIds } }],
    })
      .populate('user', 'name phone email')
      .populate('journey', 'destinationName travelMode vehicleNumber')
      .populate('responders.user', 'name phone email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: data.length,
      userId: String(req.user._id),
      data,
    });
  } catch (error) {
    console.error('Active alerts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load active alerts.',
    });
  }
});

/**
 * RESPOND TO AN SOS
 */
router.post('/:id/respond', protect, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found.',
      });
    }

    if (alert.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Alert is already resolved.',
      });
    }

    if (String(alert.user) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot respond to your own SOS.',
      });
    }

    const alreadyResponding = alert.responders.some(
      (responder) => String(responder.user) === String(req.user._id)
    );

    if (alreadyResponding) {
      return res.json({
        success: true,
        message: 'Already responding.',
        data: alert,
      });
    }

    alert.responders.push({
      user: req.user._id,
      status: 'responding',
    });

    await alert.save();

    const updated = await Alert.findById(alert._id)
      .populate('user', 'name phone email')
      .populate('responders.user', 'name phone email')
      .lean();

    const io = req.app.get('io');
    if (io) {
      const responderPayload = {
        alertId: String(alert._id),
        responder: {
          _id: String(req.user._id),
          id: String(req.user._id),
          name: req.user.name,
          phone: req.user.phone,
        },
        status: 'responding',
      };

      const recipientIds = new Set([String(alert.user), String(req.user._id)]);
      const contacts = await Contact.find({ user: alert.user })
        .select('linkedUser')
        .lean();
      contacts.forEach((c) => {
        if (c.linkedUser) {
          recipientIds.add(String(c.linkedUser));
        }
      });

      recipientIds.forEach((roomId) => {
        io.to(roomId).emit('responder_updated', responderPayload);
      });
    }

    return res.json({
      success: true,
      message: 'You are marked as responding.',
      data: updated,
    });
  } catch (error) {
    console.error('Responder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to respond to alert.',
    });
  }
});

module.exports = router;