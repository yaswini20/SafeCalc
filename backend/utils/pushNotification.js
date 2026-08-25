const fs = require('fs');
const path = require('path');

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let firebaseInitialized = false;

function initializeFirebase() {
  try {
    if (getApps().length > 0) {
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK is already initialized.');
      return;
    }

    const configuredPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      './config/firebase-service-account.json';

    const serviceAccountPath = path.resolve(
      __dirname,
      '..',
      configuredPath
    );

    console.log(`🔎 Firebase service account path: ${serviceAccountPath}`);

    if (!fs.existsSync(serviceAccountPath)) {
      console.error(
        `❌ Firebase service account file not found:\n${serviceAccountPath}`
      );
      return;
    }

    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf8')
    );

    const credential = {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    };

    if (
      !credential.projectId ||
      !credential.clientEmail ||
      !credential.privateKey
    ) {
      console.error('❌ Firebase service account is missing required fields.');
      return;
    }

    initializeApp({
      credential: cert(credential),
    });

    firebaseInitialized = true;

    console.log('✅ Firebase Admin SDK initialized successfully.');
    console.log(`🔥 Firebase project: ${credential.projectId}`);
  } catch (error) {
    firebaseInitialized = false;
    console.error(
      '❌ Firebase Admin SDK initialization failed:',
      error.message
    );
  }
}

initializeFirebase();

/**
 * Send FCM push notification with timeout protection and invalid token detection.
 */
async function sendPushNotification(
  fcmToken,
  title,
  body,
  data = {},
  timeoutMs = 6000
) {
  if (!fcmToken) {
    return { success: false, reason: 'no_token' };
  }

  if (!firebaseInitialized) {
    return { success: false, reason: 'firebase_not_initialized' };
  }

  const stringifiedData = {};
  Object.keys(data || {}).forEach((key) => {
    if (data[key] !== undefined && data[key] !== null) {
      stringifiedData[key] = String(data[key]);
    }
  });

  const message = {
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: stringifiedData,
    android: {
      priority: 'high',
      notification: {
        channelId: 'sos_alerts',
        sound: 'default',
        priority: 'high',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    const sendPromise = getMessaging().send(message);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('FCM request timeout')), timeoutMs)
    );

    const response = await Promise.race([sendPromise, timeoutPromise]);
    return { success: true, response };
  } catch (error) {
    const code = error.code || '';
    const isInvalidToken =
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument' ||
      /not registered/i.test(error.message || '');

    console.warn(`⚠️ Push notification failed for token [${fcmToken.slice(0, 10)}...]:`, error.message);

    return {
      success: false,
      reason: error.message,
      invalidToken: isInvalidToken,
    };
  }
}

function isFirebaseEnabled() {
  return firebaseInitialized;
}

module.exports = {
  sendPushNotification,
  isFirebaseEnabled,
};