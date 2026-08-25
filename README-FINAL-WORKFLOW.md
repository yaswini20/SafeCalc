# Safe Calc FINAL - replacement project

This package is based on the uploaded SafeCalc workflow and contains the corrected frontend, backend, and mobile configuration.

## Main fixes
1. Dashboard does not trigger SOS by itself. SOS is sent only after the user presses the SOS button and the countdown reaches zero.
2. Existing active SOS records are still real database state. If an old test alert is present, reset the MPIN from My Profile and resolve the old alert once.
3. Geofence map has an explicit height and is no longer blank.
4. Journey destination search resolves the exact selected search result and also geocodes the typed destination if the user presses Start without selecting a result.
5. Multiple registered Safe Calc emergency contacts are supported (up to 10 on the website).
6. Contacts are linked to registered Safe Calc users. Non-registered people cannot be saved as SOS recipients.
7. SOS delivery is app-to-app push notification through Firebase Cloud Messaging. No SMS and no email are sent.
8. End Travel requires the Safety MPIN through a website modal.
9. SOS Resolve requires the Safety MPIN through a website modal.
10. Profile has eye buttons for passwords and all MPIN fields.
11. The sidebar no longer shows a misleading permanent "Resolve SOS" item.
12. Mobile API/socket URLs can be configured with Dart `--dart-define` values.

## Frontend run

Open PowerShell:

```powershell
cd "C:\Users\Yaswini Reddy\Downloads\PDD-main\frontend"
npm install
npm run dev
```

If 5173 is already occupied, Vite will use 5174. That is okay.

Frontend `.env`:

```env
VITE_BACKEND_URL=http://localhost:5000
```

## Backend run

Open a second PowerShell:

```powershell
cd "C:\Users\Yaswini Reddy\Downloads\PDD-main\backend"
npm install
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

Do not use `C:\path\to\...`. That was only a placeholder.

## Backend .env

Create `backend/.env` from `.env.example`:

```env
PORT=5000
MONGO_URI=YOUR_MONGODB_ATLAS_CONNECTION_STRING
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=30d
FRONTEND_URL=http://localhost:5173,http://localhost:5174
AUTO_SOS_ON_TIMEOUT=false
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"YOUR_PROJECT_ID"}
```

For actual mobile push notifications, configure Firebase Admin with your real service-account JSON.

## Mobile app-to-app notification workflow

The emergency contact must:
1. Have a Safe Calc account.
2. Log in to the Safe Calc mobile app.
3. Allow notification permission.
4. Have a valid FCM token saved to the backend.

Then:

Website user taps `SEND SOS`
-> browser obtains GPS
-> backend creates active SOS
-> backend looks up linked Safe Calc contacts
-> Firebase Cloud Messaging sends push notification to each contact's mobile app
-> notification contains SOS type, user name, latitude, longitude and Google Maps URL
-> contact can open the notification/app and view the emergency details.

No SMS and no email are involved.

## Physical Android phone

For an Android emulator, the default mobile API URL is:

```text
http://10.0.2.2:5000/api
```

For a physical Android phone on the same Wi-Fi network, start the backend on the PC and run the mobile app with your PC's LAN IP:

```powershell
flutter run --dart-define=API_BASE_URL=http://YOUR-PC-IP:5000/api --dart-define=API_SOCKET_URL=http://YOUR-PC-IP:5000
```

Example:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:5000/api --dart-define=API_SOCKET_URL=http://192.168.1.10:5000
```

Windows Firewall must allow Node.js/port 5000 for the phone.

## Important about an old SOS showing on Dashboard

The website reads the active SOS from MongoDB. Replacing frontend code does not erase an existing database record.

If an old test SOS is displayed:
1. Open `My Profile`.
2. Use `Forgot MPIN? Reset MPIN`.
3. Enter the account password and create a new 4-digit MPIN.
4. Return to Dashboard.
5. Click `Resolve SOS` and enter the new MPIN.

After it is resolved, a fresh login/refresh will show `You are safe`.

## Files changed for this final workflow

Frontend:
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Journey.jsx`
- `frontend/src/pages/Geofences.jsx`
- `frontend/src/pages/Contacts.jsx`
- `frontend/src/pages/Profile.jsx`
- `frontend/src/components/Layout.jsx`
- `frontend/src/App.css`

Backend:
- `backend/server.js`
- `backend/routes/auth.js`
- `backend/routes/alert.js`
- `backend/routes/contact.js`
- `backend/routes/journey.js`
- `backend/routes/safeplace.js`
- `backend/utils/pushNotification.js`
- `backend/utils/notification.js`
- `backend/package.json`
- `backend/.env.example`

Mobile:
- `mobile/lib/services/api_service.dart`
- `mobile/lib/services/socket_service.dart`

The remaining project files are retained from the uploaded project.
