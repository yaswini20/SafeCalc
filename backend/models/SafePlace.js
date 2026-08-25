const mongoose = require('mongoose');

const SafePlaceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  radius: {
    type: Number,
    required: true, // in meters, e.g. 200
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

SafePlaceSchema.index({ user: 1 });

module.exports = mongoose.model('SafePlace', SafePlaceSchema);

