const express = require('express');
const Journey = require('../models/Journey');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Contact = require('../models/Contact');
const { protect } = require('../middleware/auth');

const router = express.Router();
const MODES = ['Ola', 'Uber', 'Rapido', 'Own Vehicle', 'Other'];

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function activeQuery(userId) {
  return {
    user: userId,
    status: { $in: ['active', 'grace_period', 'check_in_requested', 'sos_triggered'] },
  };
}

async function verifyMpin(user, mpin) {
  return /^\d{4}$/.test(String(mpin || '')) && user && (await user.matchMPIN(String(mpin)));
}

async function completeJourney(req, journey, message) {
  journey.status = 'completed';
  journey.completedAt = new Date();
  await journey.save();

  await Alert.updateMany(
    { user: req.user._id, journey: journey._id, status: 'active' },
    { $set: { status: 'resolved', resolvedAt: new Date() } }
  );

  const io = req.app.get('io');
  if (io) {
    io.to(String(req.user._id)).emit('journey_completed', {
      journeyId: String(journey._id),
      userId: String(req.user._id),
    });
    io.to(String(req.user._id)).emit('sos_resolved', {
      userId: String(req.user._id),
    });

    // Notify contact rooms in case there was an active SOS
    const contacts = await Contact.find({ user: req.user._id })
      .select('linkedUser')
      .lean();
    contacts.forEach((c) => {
      if (c.linkedUser) {
        io.to(String(c.linkedUser)).emit('sos_resolved', {
          userId: String(req.user._id),
        });
      }
    });
  }
  return { success: true, message, data: journey };
}

router.post('/start', protect, async (req, res) => {
  try {
    const {
      destinationName,
      destinationLatitude,
      destinationLongitude,
      destinationRadius,
      travelMode,
      vehicleNumber,
      expectedReachTime,
      currentLatitude,
      currentLongitude,
    } = req.body;

    const lat = Number(destinationLatitude);
    const lon = Number(destinationLongitude);
    const radius = Number(destinationRadius);
    const currentLat = Number(currentLatitude);
    const currentLon = Number(currentLongitude);

    if (
      !destinationName?.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(radius) ||
      radius < 10 ||
      !expectedReachTime ||
      !MODES.includes(travelMode)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Destination, valid coordinates, radius, travel mode and expected arrival are required.',
      });
    }

    if (await Journey.findOne(activeQuery(req.user._id))) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active journey.',
      });
    }

    const reach = new Date(expectedReachTime);
    if (Number.isNaN(reach.getTime()) || reach <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Expected arrival must be in the future.',
      });
    }

    const grace = new Date(reach.getTime() + 15 * 60000);
    const check = new Date(grace.getTime() + 5 * 60000);
    const hasCurrent = Number.isFinite(currentLat) && Number.isFinite(currentLon);

    const journey = await Journey.create({
      user: req.user._id,
      destinationName: String(destinationName).trim(),
      destinationLatitude: lat,
      destinationLongitude: lon,
      destinationRadius: radius,
      travelMode,
      vehicleNumber: String(vehicleNumber || '').trim(),
      currentLatitude: hasCurrent ? currentLat : undefined,
      currentLongitude: hasCurrent ? currentLon : undefined,
      breadcrumbs: hasCurrent ? [{ latitude: currentLat, longitude: currentLon }] : [],
      status: 'active',
      expectedReachTime: reach,
      gracePeriodEndsAt: grace,
      checkInEndsAt: check,
    });

    if (hasCurrent) {
      await User.findByIdAndUpdate(req.user._id, {
        location: { type: 'Point', coordinates: [currentLon, currentLat] },
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(String(req.user._id)).emit('journey_started', {
        journeyId: String(journey._id),
        userId: String(req.user._id),
        destinationName: journey.destinationName,
        travelMode: journey.travelMode,
        vehicleNumber: journey.vehicleNumber,
        expectedReachTime: journey.expectedReachTime,
      });
    }

    return res.status(201).json({ success: true, data: journey });
  } catch (error) {
    console.error('Start journey error:', error);
    return res.status(500).json({ success: false, message: 'Unable to start journey.' });
  }
});

router.get('/active', protect, async (req, res) => {
  try {
    const journey = await Journey.findOne(activeQuery(req.user._id)).lean();
    return res.json({ success: true, data: journey || null });
  } catch (error) {
    console.error('Active journey error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load journey.' });
  }
});

router.post('/update-location', protect, async (req, res) => {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, message: 'Valid coordinates are required.' });
    }

    const journey = await Journey.findOne(activeQuery(req.user._id));
    if (!journey) {
      return res.status(404).json({ success: false, message: 'No active journey found.' });
    }

    journey.currentLatitude = latitude;
    journey.currentLongitude = longitude;
    journey.breadcrumbs.push({ latitude, longitude });
    await journey.save();

    await User.findByIdAndUpdate(req.user._id, {
      location: { type: 'Point', coordinates: [longitude, latitude] },
    });

    const remaining = distanceMeters(
      latitude,
      longitude,
      journey.destinationLatitude,
      journey.destinationLongitude
    );
    const reached = remaining <= journey.destinationRadius;

    const io = req.app.get('io');
    if (io) {
      io.to(String(req.user._id)).emit('journey_updated', {
        journeyId: String(journey._id),
        userId: String(req.user._id),
        latitude,
        longitude,
        reached,
        distanceRemaining: remaining,
      });
    }

    return res.json({
      success: true,
      data: journey,
      reached,
      distanceRemaining: remaining,
    });
  } catch (error) {
    console.error('Update journey location error:', error);
    return res.status(500).json({ success: false, message: 'Unable to update journey location.' });
  }
});

router.post('/check-in', protect, async (req, res) => {
  try {
    const action = String(req.body.action || '');
    if (!['complete', 'extend'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid check-in action.' });
    }
    if (!(await verifyMpin(req.user, req.body.mpin))) {
      return res.status(401).json({ success: false, message: 'Incorrect MPIN.' });
    }

    const journey = await Journey.findOne(activeQuery(req.user._id));
    if (!journey) {
      return res.status(404).json({ success: false, message: 'No active journey found.' });
    }

    if (action === 'complete') {
      const result = await completeJourney(req, journey, 'Journey completed safely.');
      return res.json(result);
    }

    const reach = new Date(Date.now() + 15 * 60000);
    journey.status = 'active';
    journey.expectedReachTime = reach;
    journey.gracePeriodEndsAt = new Date(reach.getTime() + 15 * 60000);
    journey.checkInEndsAt = new Date(reach.getTime() + 20 * 60000);
    await journey.save();

    const io = req.app.get('io');
    if (io) {
      io.to(String(req.user._id)).emit('journey_extended', {
        journeyId: String(journey._id),
        userId: String(req.user._id),
        expectedReachTime: reach,
      });
    }

    return res.json({
      success: true,
      message: 'Journey extended by 15 minutes.',
      data: journey,
    });
  } catch (error) {
    console.error('Journey check-in error:', error);
    return res.status(500).json({ success: false, message: 'Unable to process safety check-in.' });
  }
});

router.post('/end', protect, async (req, res) => {
  try {
    if (!(await verifyMpin(req.user, req.body.mpin))) {
      return res.status(401).json({ success: false, message: 'Incorrect MPIN.' });
    }
    const journey = await Journey.findOne(activeQuery(req.user._id));
    if (!journey) {
      return res.status(404).json({ success: false, message: 'No active journey found.' });
    }
    return res.json(await completeJourney(req, journey, 'Travel ended safely.'));
  } catch (error) {
    console.error('End travel error:', error);
    return res.status(500).json({ success: false, message: 'Unable to end travel.' });
  }
});

router.get('/history', protect, async (req, res) => {
  try {
    const data = await Journey.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Journey history error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load travel history.' });
  }
});

module.exports = router;
