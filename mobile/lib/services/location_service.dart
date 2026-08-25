import 'package:flutter/services.dart';

class LocationServiceWrapper {
  static const MethodChannel _channel = MethodChannel('com.travelsafetysos.mobile/tracking');
  
  static Function(double lat, double lng, double distance)? onLocationUpdate;
  static Function(double lat, double lng)? onGeofenceBreach;

  static Future<void> init() async {
    _channel.setMethodCallHandler((MethodCall call) async {
      print('MethodChannel call received: ${call.method}');
      switch (call.method) {
        case 'onLocationUpdate':
          final arguments = Map<String, dynamic>.from(call.arguments);
          final double lat = arguments['lat'];
          final double lng = arguments['lng'];
          final double distance = arguments['distance'];
          
          if (onLocationUpdate != null) {
            onLocationUpdate!(lat, lng, distance);
          }
          break;
        case 'onGeofenceBreach':
          final arguments = Map<String, dynamic>.from(call.arguments);
          final double lat = arguments['lat'];
          final double lng = arguments['lng'];
          
          if (onGeofenceBreach != null) {
            onGeofenceBreach!(lat, lng);
          }
          break;
        default:
          print('Unrecognized MethodChannel callback: ${call.method}');
      }
    });
  }

  // Start foreground tracking service with destination details
  static Future<bool> startTracking({
    required double destLat,
    required double destLng,
    required double destRadius,
  }) async {
    try {
      final bool success = await _channel.invokeMethod('startTracking', {
        'destLat': destLat,
        'destLng': destLng,
        'destRadius': destRadius,
      });
      return success;
    } on PlatformException catch (e) {
      print('Error starting native tracking: $e');
      return false;
    }
  }

  // Stop foreground tracking service
  static Future<bool> stopTracking() async {
    try {
      final bool success = await _channel.invokeMethod('stopTracking');
      return success;
    } on PlatformException catch (e) {
      print('Error stopping native tracking: $e');
      return false;
    }
  }
}
