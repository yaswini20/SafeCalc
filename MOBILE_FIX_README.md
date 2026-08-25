# PDD Main 2 - Mobile Fix

This version keeps the existing web application and backend structure, while fixing the Flutter mobile networking/startup flow.

## Mobile API
The mobile app now uses the hosted backend by default:
`https://pdd-mkge.onrender.com/api`

This means the phone does not need to be connected to the laptop to load profile, contacts, journeys, or history.

## Important: remove the old APK first
The previous installed APK may still contain the old `10.x.x.x:5000` API address even if `api_service.dart` was edited. Uninstall the old Safe Calc app from the phone before installing a new build.

## Build and install
From the `PDD Main 2/mobile` folder:

```powershell
flutter clean
flutter pub get
flutter run -d CPH2401
```

Use your actual device ID, for example:

```powershell
flutter devices
flutter run -d CPH2401
```

Do **not** pass an old `--dart-define=API_BASE_URL=http://10...:5000/api` value. The project default is already the hosted Render API.

## End Travel
End Travel now opens a 4-digit MPIN dialog and calls `/api/journey/end`, which matches the backend route. On successful verification the journey is completed, location tracking is stopped, and history is refreshed.

## Startup speed
Firebase/FCM initialization is moved after the first Flutter frame, so opening the mobile app is not blocked by notification/network initialization. API requests also have a 20-second timeout.

## Notifications
The Android notification channel is `sos_alerts`, matching the backend FCM configuration. FCM registration is still uploaded to the authenticated user.

## Flutter assertion fix
Dialog TextEditingControllers used by the SOS/End Travel MPIN dialogs are no longer disposed immediately while the dialog route is finishing, preventing the Flutter `_dependents.isEmpty` assertion seen on the phone.

## Backend
The backend already contains `/journey/end`, `/journey/history`, `/auth/me`, `/auth/fcm-token`, and the profile/contact routes used by the mobile app.
