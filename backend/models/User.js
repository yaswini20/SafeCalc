const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  mpin: {
    type: String,
    required: true, // 4-digit safety MPIN hashed
  },
  gender: {
    type: String,
    default: '',
  },
  bloodGroup: {
    type: String,
    default: '',
  },
  dob: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    },
  },
  fcmToken: {
    type: String,
    default: null,
  },
});

UserSchema.index({ location: '2dsphere' });


// Hash password and MPIN before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') && !this.isModified('mpin')) {
    return next();
  }

  try {
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    if (this.isModified('mpin')) {
      const salt = await bcrypt.genSalt(10);
      this.mpin = await bcrypt.hash(this.mpin, salt);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Compare MPIN
UserSchema.methods.matchMPIN = async function (enteredMPIN) {
  return await bcrypt.compare(enteredMPIN, this.mpin);
};

module.exports = mongoose.model('User', UserSchema);
