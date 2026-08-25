import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../main.dart';
import '../screens/responder_map_screen.dart';
import 'api_service.dart';

final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

const AndroidNotificationChannel _emergencyChannel = AndroidNotificationChannel(
  'sos_alerts',
  'Safe Calc Emergency Alerts',
  description: 'Emergency SOS notifications from Safe Calc contacts.',
  importance: Importance.max,
  playSound: true,
);

Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class PushNotificationService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    try {
      const android = AndroidInitializationSettings('@mipmap/ic_launcher');
      const ios = DarwinInitializationSettings();
      const settings = InitializationSettings(android: android, iOS: ios);

      await _localNotifications.initialize(
        settings,
        onDidReceiveNotificationResponse: (response) {
          print('Safe Calc notification opened with payload: ${response.payload}');
          _handleNotificationPayload(response.payload);
        },
      );

      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(_emergencyChannel);

      await _firebaseMessaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
        await _showEmergencyNotification(message);
      });

      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        print('Safe Calc FCM notification opened: ${message.data}');
        navigateToEmergencyMap(message.data);
      });

      final initialMessage = await _firebaseMessaging.getInitialMessage();
      if (initialMessage != null) {
        print('Safe Calc launched from FCM notification: ${initialMessage.data}');
        WidgetsBinding.instance.addPostFrameCallback((_) {
          navigateToEmergencyMap(initialMessage.data);
        });
      }

      _initialized = true;
      await uploadToken();

      _firebaseMessaging.onTokenRefresh.listen((token) async {
        await ApiService.updateFcmToken(token);
      });
    } catch (e) {
      print('Error initializing Safe Calc push notifications: $e');
    }
  }

  static void navigateToEmergencyMap(Map<String, dynamic> data) {
    try {
      print('Processing notification emergency map navigation with data: $data');
      final String type = data['type']?.toString() ?? 'sos';
      if (type == 'sos_resolved') return;

      final alertId = data['alertId']?.toString() ?? '';
      final userName = data['userName']?.toString() ?? data['user']?['name']?.toString() ?? 'Emergency Contact';
      final userPhone = data['userPhone']?.toString() ?? data['user']?['phone']?.toString() ?? '';
      final lat = double.tryParse(data['latitude']?.toString() ?? '') ?? 0.0;
      final lng = double.tryParse(data['longitude']?.toString() ?? '') ?? 0.0;

      if (lat == 0.0 && lng == 0.0) {
        print('Invalid coordinates in notification data, skipping navigation.');
        return;
      }

      void doNavigate() {
        if (navigatorKey.currentState != null) {
          navigatorKey.currentState!.push(
            MaterialPageRoute(
              builder: (context) => ResponderMapScreen(
                alertId: alertId,
                dangerUserName: userName,
                dangerUserPhone: userPhone,
                latitude: lat,
                longitude: lng,
              ),
            ),
          );
        }
      }

      if (navigatorKey.currentState != null) {
        doNavigate();
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          doNavigate();
        });
      }
    } catch (e) {
      print('Error navigating to emergency map screen: $e');
    }
  }

  static void _handleNotificationPayload(String? payloadStr) {
    if (payloadStr == null || payloadStr.isEmpty) return;
    try {
      final data = jsonDecode(payloadStr) as Map<String, dynamic>;
      navigateToEmergencyMap(data);
    } catch (e) {
      print('Error decoding notification payload: $e');
    }
  }

  static Future<void> _showEmergencyNotification(RemoteMessage message) async {
    final data = message.data;
    final title = message.notification?.title ??
        (data['type'] == 'sos_resolved'
            ? '✅ SOS RESOLVED'
            : '🚨 EMERGENCY SOS');
    final body = message.notification?.body ??
        (data['type'] == 'sos_resolved'
            ? '${data['userName'] ?? 'Your contact'} is safe.'
            : '${data['userName'] ?? 'Your contact'} needs help.');

    final details = NotificationDetails(
      android: AndroidNotificationDetails(
        _emergencyChannel.id,
        _emergencyChannel.name,
        channelDescription: _emergencyChannel.description,
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        icon: '@mipmap/ic_launcher',
      ),
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch.remainder(1 << 31),
      title,
      body,
      details,
      payload: jsonEncode(data),
    );
  }

  static Future<void> uploadToken() async {
    try {
      if (!ApiService.isAuthenticated) return;
      final token = await _firebaseMessaging.getToken();
      if (token != null && token.isNotEmpty) {
        await ApiService.updateFcmToken(token);
      }
    } catch (e) {
      print('Error retrieving Safe Calc FCM token: $e');
    }
  }
}
