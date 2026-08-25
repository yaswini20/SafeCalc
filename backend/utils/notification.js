const { sendPushNotification } = require('./pushNotification');
const User = require('../models/User');

function mapUrl(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

// Safe Calc deliberately uses app-to-app push notifications only.
// No SMS and no email are sent by this workflow.
async function sendEmergencyNotifications(user, alert, contacts) {
  if (!user || !alert || !Array.isArray(contacts) || !contacts.length) {
    return { sent: 0, skipped: 0 };
  }

  const linkedIds = contacts
    .map((contact) => contact.linkedUser?._id || contact.linkedUser)
    .filter(Boolean)
    .map(String);

  if (!linkedIds.length) {
    return { sent: 0, skipped: contacts.length };
  }

  const recipients = await User.find({ _id: { $in: linkedIds } })
    .select('_id name fcmToken')
    .lean();

  const locationUrl = mapUrl(alert.latitude, alert.longitude);
  const body = `🚨 EMERGENCY! ${user.name} needs help! Location: ${Number(alert.latitude).toFixed(5)}, ${Number(alert.longitude).toFixed(5)}. View live map: ${locationUrl}`;
  const data = {
    type: 'sos',
    alertId: String(alert._id),
    userId: String(user._id),
    userName: user.name,
    userPhone: user.phone || '',
    latitude: String(alert.latitude),
    longitude: String(alert.longitude),
    time: new Date(alert.createdAt || Date.now()).toISOString(),
    mapUrl: locationUrl,
    triggerType: alert.triggerType || 'manual_sos',
  };

  let sent = 0;
  let skipped = 0;

  await Promise.all(
    recipients.map(async (recipient) => {
      if (!recipient.fcmToken) {
        skipped += 1;
        return;
      }

      const res = await sendPushNotification(
        recipient.fcmToken,
        `🚨 EMERGENCY SOS — ${user.name}`,
        body,
        data
      );

      if (res.success) {
        sent += 1;
      } else {
        skipped += 1;
        if (res.invalidToken) {
          // Clean up invalid/unregistered token from database
          User.updateOne(
            { _id: recipient._id },
            { $unset: { fcmToken: 1 } }
          ).catch((err) =>
            console.error('Failed to clear invalid FCM token:', err.message)
          );
        }
      }
    })
  );

  console.log(`Safe Calc app notifications: ${sent} sent, ${skipped} skipped.`);
  return { sent, skipped };
}

async function sendSosResolvedNotification(user, alert, contacts) {
  if (!user || !alert || !Array.isArray(contacts) || !contacts.length) return;
  const linkedIds = contacts
    .map((contact) => contact.linkedUser?._id || contact.linkedUser)
    .filter(Boolean)
    .map(String);

  if (!linkedIds.length) return;

  const recipients = await User.find({ _id: { $in: linkedIds } })
    .select('_id name fcmToken')
    .lean();

  const data = {
    type: 'sos_resolved',
    alertId: String(alert._id),
    userId: String(user._id),
    userName: user.name,
  };

  await Promise.all(
    recipients.map(async (recipient) => {
      if (!recipient.fcmToken) return;
      const res = await sendPushNotification(
        recipient.fcmToken,
        `✅ SOS RESOLVED — ${user.name}`,
        `${user.name} has confirmed that they are safe.`,
        data
      );
      if (!res.success && res.invalidToken) {
        User.updateOne(
          { _id: recipient._id },
          { $unset: { fcmToken: 1 } }
        ).catch(() => {});
      }
    })
  );
}

module.exports = { sendEmergencyNotifications, sendSosResolvedNotification };
