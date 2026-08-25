const express = require('express');
const SafePlace = require('../models/SafePlace');
const { protect } = require('../middleware/auth');

const router = express.Router();

function finite(value) {
  return Number.isFinite(Number(value));
}

router.get('/', protect, async (req, res) => {
  try {
    const data = await SafePlace.find({ user: req.user._id }).sort({ createdAt: 1 });
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Load safe places error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load safe places.' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const radius = Number(req.body.radius);

    if (!name || !finite(latitude) || !finite(longitude) || !finite(radius) || radius < 10 || radius > 10000) {
      return res.status(400).json({ success: false, message: 'Enter a name, valid coordinates and a radius between 10m and 10000m.' });
    }

    const place = await SafePlace.create({
      user: req.user._id,
      name,
      latitude,
      longitude,
      radius,
    });
    return res.status(201).json({ success: true, data: place });
  } catch (error) {
    console.error('Create safe place error:', error);
    return res.status(500).json({ success: false, message: 'Unable to save safe place.' });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const place = await SafePlace.findOne({ _id: req.params.id, user: req.user._id });
    if (!place) return res.status(404).json({ success: false, message: 'Safe place not found.' });

    const name = String(req.body.name || place.name).trim();
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const radius = Number(req.body.radius);

    if (!name || !finite(latitude) || !finite(longitude) || !finite(radius) || radius < 10 || radius > 10000) {
      return res.status(400).json({ success: false, message: 'Invalid safe place data.' });
    }

    place.name = name;
    place.latitude = latitude;
    place.longitude = longitude;
    place.radius = radius;
    await place.save();
    return res.json({ success: true, data: place });
  } catch (error) {
    console.error('Update safe place error:', error);
    return res.status(500).json({ success: false, message: 'Unable to update safe place.' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const place = await SafePlace.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!place) return res.status(404).json({ success: false, message: 'Safe place not found.' });
    return res.json({ success: true, message: 'Safe place deleted.' });
  } catch (error) {
    console.error('Delete safe place error:', error);
    return res.status(500).json({ success: false, message: 'Unable to delete safe place.' });
  }
});

module.exports = router;
