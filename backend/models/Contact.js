const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  linkedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  relationship: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

ContactSchema.index({ user: 1 });
ContactSchema.index({ linkedUser: 1 });
ContactSchema.index({ user: 1, linkedUser: 1 });

module.exports = mongoose.model('Contact', ContactSchema);

