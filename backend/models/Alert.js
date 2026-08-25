const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  journey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey',
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  triggerType: {
    type: String,
    enum: ['manual_sos', 'geofence_breach', 'timeout', 'other'],
    default: 'manual_sos',
  },
  status: {
    type: String,
    enum: ['active', 'resolved'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: {
    type: Date,
  },
  responders: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      status: {
        type: String,
        enum: ['responding', 'arrived'],
        default: 'responding',
      },
      respondedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

AlertSchema.index({ user: 1, status: 1 });
AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ 'responders.user': 1 });

module.exports = mongoose.model('Alert', AlertSchema);

