const mongoose = require('mongoose');

const LocationBreadcrumbSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

const JourneySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  destinationName: {
    type: String,
    required: true,
  },
  destinationLatitude: {
    type: Number,
    required: true,
  },
  destinationLongitude: {
    type: Number,
    required: true,
  },
  destinationRadius: {
    type: Number,
    required: true, // in meters, e.g. 200
  },
  travelMode: {
    type: String,
    enum: ['Ola', 'Uber', 'Rapido', 'Own Vehicle', 'Other'],
    required: true,
  },
  vehicleNumber: {
    type: String,
    trim: true,
  },
  currentLatitude: {
    type: Number,
  },
  currentLongitude: {
    type: Number,
  },
  breadcrumbs: [LocationBreadcrumbSchema],
  status: {
    type: String,
    enum: ['planning', 'active', 'completed', 'grace_period', 'check_in_requested', 'sos_triggered'],
    default: 'active',
  },
  expectedReachTime: {
    type: Date,
    required: true,
  },
  gracePeriodEndsAt: {
    type: Date, // expectedReachTime + 15 mins
  },
  checkInEndsAt: {
    type: Date, // gracePeriodEndsAt + 5 mins
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
});

JourneySchema.index({ user: 1, status: 1 });
JourneySchema.index({ status: 1, expectedReachTime: 1 });
JourneySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Journey', JourneySchema);

