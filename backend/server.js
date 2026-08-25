require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const Journey = require('./models/Journey');
const Alert = require('./models/Alert');
const Contact = require('./models/Contact');
const User = require('./models/User');
const { sendEmergencyNotifications } = require('./utils/notification');

const auth = require('./routes/auth');
const contacts = require('./routes/contact');
const safeplaces = require('./routes/safeplace');
const journeys = require('./routes/journey');
const alerts = require('./routes/alert');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 20000,
  pingInterval: 10000,
});
app.set('io', io);

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) =>
  res.json({
    success: true,
    service: 'Safe Calc API',
    time: new Date().toISOString(),
  })
);

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', auth);
app.use('/api/contacts', contacts);
app.use('/api/safeplaces', safeplaces);
app.use('/api/journey', journeys);
app.use('/api/alerts', alerts);

app.get('/', (req, res) =>
  res.json({ success: true, message: 'Safe Calc API is running.' })
);

io.on('connection', (socket) => {
  socket.on('join_user', (userId) => {
    if (userId) {
      const room = String(userId);
      socket.join(room);
    }
  });
});

let checkerRunning = false;

async function safetyChecker() {
  if (checkerRunning) return;
  checkerRunning = true;

  try {
    const now = new Date();
    const activeJourneys = await Journey.find({
      status: { $in: ['active', 'grace_period', 'check_in_requested'] },
    }).populate('user', 'name phone email fcmToken');

    for (const journey of activeJourneys) {
      if (!journey.user) continue;
      const user = journey.user;

      if (journey.status === 'active' && now > journey.expectedReachTime) {
        journey.status = 'grace_period';
        await journey.save();
        io.to(String(user._id)).emit('notify_check_in_alert', {
          journeyId: String(journey._id),
          message: 'Expected arrival time reached. Grace period started.',
          secondsRemaining: Math.max(
            0,
            Math.floor((journey.gracePeriodEndsAt - now) / 1000)
          ),
        });
      } else if (
        journey.status === 'grace_period' &&
        now > journey.gracePeriodEndsAt
      ) {
        journey.status = 'check_in_requested';
        await journey.save();
        io.to(String(user._id)).emit('trigger_mpin_prompt', {
          journeyId: String(journey._id),
          message: 'Safety check-in required. Enter your MPIN within 5 minutes.',
          secondsRemaining: 300,
        });
      } else if (
        journey.status === 'check_in_requested' &&
        journey.checkInEndsAt &&
        now > journey.checkInEndsAt &&
        process.env.AUTO_SOS_ON_TIMEOUT === 'true'
      ) {
        const existing = await Alert.findOne({
          user: user._id,
          journey: journey._id,
          status: 'active',
        });
        if (existing) continue;

        journey.status = 'sos_triggered';
        await journey.save();

        const latitude =
          journey.currentLatitude ?? journey.destinationLatitude;
        const longitude =
          journey.currentLongitude ?? journey.destinationLongitude;
        const alert = await Alert.create({
          user: user._id,
          journey: journey._id,
          latitude,
          longitude,
          triggerType: 'timeout',
          status: 'active',
        });

        const contactRows = await Contact.find({ user: user._id })
          .populate('linkedUser', 'name phone email fcmToken')
          .lean();

        const payload = {
          alertId: String(alert._id),
          userId: String(user._id),
          user: {
            id: String(user._id),
            name: user.name,
            phone: user.phone,
            email: user.email,
          },
          journey: {
            id: String(journey._id),
            destinationName: journey.destinationName,
            travelMode: journey.travelMode,
            vehicleNumber: journey.vehicleNumber,
          },
          latitude,
          longitude,
          triggerType: 'timeout',
          createdAt: alert.createdAt,
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        };

        const recipientIds = new Set([String(user._id)]);
        contactRows.forEach((contact) => {
          if (contact.linkedUser?._id) {
            recipientIds.add(String(contact.linkedUser._id));
          }
        });

        recipientIds.forEach((id) => {
          io.to(id).emit('sos_triggered', payload);
          // Legacy mobile event name
          io.to(id).emit('nearby_sos_alert', payload);
          io.to(id).emit('emergency_escalated', payload);
        });

        sendEmergencyNotifications(user, alert, contactRows).catch((error) =>
          console.error('Timeout SOS notification error:', error.message)
        );
      }
    }
  } catch (error) {
    console.error('Safety checker error:', error.message);
  } finally {
    checkerRunning = false;
  }
}

async function start() {
  try {
    await connectDB();
    const port = Number(process.env.PORT || 5000);
    server.listen(port, '0.0.0.0', () => {
      console.log(`Safe Calc API listening on http://0.0.0.0:${port}`);
    });
    setInterval(safetyChecker, 10000);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

start();
