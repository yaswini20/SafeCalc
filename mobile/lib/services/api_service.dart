import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Default server host IP.
  // Change this to match your laptop Wi-Fi IP (ipconfig).
  static String _serverHost = 'http://10.156.191.243:5000';

  static String _token = '';

  static const Duration _requestTimeout = Duration(seconds: 20);

  static String get baseUrl => '$_serverHost/api';

  static String get serverHost => _serverHost;

  static Future<http.Response> _get(Uri uri, {Map<String, String>? headers}) =>
      http.get(uri, headers: headers).timeout(_requestTimeout);

  static Future<http.Response> _post(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) => http.post(uri, headers: headers, body: body).timeout(_requestTimeout);

  static Future<http.Response> _put(
    Uri uri, {
    Map<String, String>? headers,
    Object? body,
  }) => http.put(uri, headers: headers, body: body).timeout(_requestTimeout);

  static Future<http.Response> _delete(
    Uri uri, {
    Map<String, String>? headers,
  }) => http.delete(uri, headers: headers).timeout(_requestTimeout);

  static Future<void> setServerHost(String host) async {
    var formatted = host.trim();

    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'http://$formatted';
    }

    if (formatted.endsWith('/')) {
      formatted = formatted.substring(0, formatted.length - 1);
    }

    if (formatted.endsWith('/api')) {
      formatted = formatted.substring(0, formatted.length - 4);
    }

    _serverHost = formatted;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('serverHost', formatted);
  }

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();

    _token = prefs.getString('token') ?? '';

    const defaultHost = 'http://10.156.191.243:5000';
    final savedHost = prefs.getString('serverHost');

    if (savedHost != null && savedHost.isNotEmpty && !savedHost.contains('172.27.78.243')) {
      _serverHost = savedHost;
    } else {
      _serverHost = defaultHost;
      await prefs.setString('serverHost', defaultHost);
    }
  }

  static String get token => _token;

  static bool get isAuthenticated => _token.isNotEmpty;

  static Future<Map<String, String>> _headers() async {
    return {
      'Content-Type': 'application/json',
      if (_token.isNotEmpty) 'Authorization': 'Bearer $_token',
    };
  }

  // LOGIN
  static Future<Map<String, dynamic>> login(
    String email,
    String password,
  ) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/auth/login'),
        headers: await _headers(),
        body: jsonEncode({'email': email, 'password': password}),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        _token = data['data']['token'];

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', _token);

        return {'success': true, 'user': data['data']};
      }

      return {'success': false, 'message': data['message'] ?? 'Login failed'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // REGISTER
  static Future<Map<String, dynamic>> register(
    String name,
    String email,
    String phone,
    String password,
    String mpin,
  ) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/auth/register'),
        headers: await _headers(),
        body: jsonEncode({
          'name': name,
          'email': email,
          'phone': phone,
          'password': password,
          'mpin': mpin,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        _token = data['data']['token'];

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', _token);

        return {'success': true, 'user': data['data']};
      }

      return {
        'success': false,
        'message': data['message'] ?? 'Registration failed',
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // LOGOUT
  static Future<void> logout() async {
    _token = '';

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
  }

  // UPDATE FCM TOKEN
  static Future<bool> updateFcmToken(String fcmToken) async {
    try {
      final response = await _put(
        Uri.parse('$baseUrl/auth/fcm-token'),
        headers: await _headers(),
        body: jsonEncode({'fcmToken': fcmToken}),
      );

      final data = jsonDecode(response.body);

      return response.statusCode == 200 && data['success'] == true;
    } catch (e) {
      print('Error updating FCM token: $e');
      return false;
    }
  }

  // GET ACTIVE JOURNEY
  static Future<Map<String, dynamic>?> getActiveJourney() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/journey/active'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return data['data'];
      }
    } catch (e) {
      print('Error getting active journey: $e');
    }

    return null;
  }

  // START JOURNEY
  static Future<Map<String, dynamic>> startJourney({
    required String destinationName,
    required double destinationLatitude,
    required double destinationLongitude,
    required double destinationRadius,
    required String travelMode,
    required String vehicleNumber,
    required DateTime expectedReachTime,
    required double currentLatitude,
    required double currentLongitude,
  }) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/journey/start'),
        headers: await _headers(),
        body: jsonEncode({
          'destinationName': destinationName,
          'destinationLatitude': destinationLatitude,
          'destinationLongitude': destinationLongitude,
          'destinationRadius': destinationRadius,
          'travelMode': travelMode,
          'vehicleNumber': vehicleNumber,
          'expectedReachTime': expectedReachTime.toIso8601String(),
          'currentLatitude': currentLatitude,
          'currentLongitude': currentLongitude,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        return {'success': true, 'data': data['data']};
      }

      return {
        'success': false,
        'message': data['message'] ?? 'Failed to start journey',
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // UPDATE JOURNEY LOCATION
  static Future<void> updateJourneyLocation(
    double latitude,
    double longitude,
  ) async {
    try {
      await _post(
        Uri.parse('$baseUrl/journey/update-location'),
        headers: await _headers(),
        body: jsonEncode({'latitude': latitude, 'longitude': longitude}),
      );
    } catch (e) {
      print('Error updating journey location: $e');
    }
  }

  // CHECK IN
  static Future<Map<String, dynamic>> checkIn(
    String mpin,
    String action,
  ) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/journey/check-in'),
        headers: await _headers(),
        body: jsonEncode({'mpin': mpin, 'action': action}),
      );

      final data = jsonDecode(response.body);

      return {
        'success': data['success'] == true,
        'message': data['message'] ?? 'Verification failed',
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // END JOURNEY WITH MPIN
  static Future<Map<String, dynamic>> endJourney(String mpin) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/journey/end'),
        headers: await _headers(),
        body: jsonEncode({'mpin': mpin}),
      );

      final data = jsonDecode(response.body);

      return {
        'success': response.statusCode == 200 && data['success'] == true,
        'message': data['message'] ?? 'Unable to end travel.',
        'data': data['data'],
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // TRIGGER SOS
  static Future<Map<String, dynamic>> triggerSOS(
    double latitude,
    double longitude, {
    String triggerType = 'manual_sos',
  }) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/alerts/trigger'),
        headers: await _headers(),
        body: jsonEncode({
          'latitude': latitude,
          'longitude': longitude,
          'triggerType': triggerType,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        return {'success': true, 'contacts': data['contacts'] ?? []};
      }

      return {
        'success': false,
        'message': data['message'] ?? 'Failed to trigger SOS',
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // RESOLVE SOS
  static Future<Map<String, dynamic>> resolveSOS(String mpin) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/alerts/resolve'),
        headers: await _headers(),
        body: jsonEncode({'mpin': mpin}),
      );

      final data = jsonDecode(response.body);

      return {
        'success': data['success'] == true,
        'message': data['message'] ?? 'Unable to resolve SOS',
      };
    } catch (e) {
      print('Error resolving SOS: $e');

      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // GET SAFE PLACES
  static Future<List<dynamic>> getSafePlaces() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/safeplaces'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        return data['data'] ?? [];
      }
    } catch (e) {
      print('Error loading safe places: $e');
    }

    return [];
  }

  // ADD SAFE PLACE
  static Future<bool> addSafePlace(
    String name,
    double lat,
    double lng,
    double radius,
  ) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/safeplaces'),
        headers: await _headers(),
        body: jsonEncode({
          'name': name,
          'latitude': lat,
          'longitude': lng,
          'radius': radius,
        }),
      );

      final data = jsonDecode(response.body);

      return data['success'] == true;
    } catch (e) {
      print('Error adding safe place: $e');
      return false;
    }
  }

  // DELETE SAFE PLACE
  static Future<bool> deleteSafePlace(String id) async {
    try {
      final response = await _delete(
        Uri.parse('$baseUrl/safeplaces/$id'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      return data['success'] == true;
    } catch (e) {
      print('Error removing safe place: $e');
      return false;
    }
  }

  // GET EMERGENCY CONTACTS
  static Future<List<dynamic>> getContacts() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/contacts'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        return data['data'] ?? [];
      }
    } catch (e) {
      print('Error getting contacts: $e');
    }

    return [];
  }

  // ADD EMERGENCY CONTACT
  static Future<bool> addContact(
    String name,
    String phone,
    String email,
    String relationship,
  ) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/contacts'),
        headers: await _headers(),
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'email': email,
          'relationship': relationship,
        }),
      );

      final data = jsonDecode(response.body);

      return data['success'] == true;
    } catch (e) {
      print('Error adding contact: $e');
      return false;
    }
  }

  // UPDATE EMERGENCY CONTACT
  static Future<bool> updateContact(
    String id,
    String name,
    String phone,
    String email,
    String relationship,
  ) async {
    try {
      final response = await _put(
        Uri.parse('$baseUrl/contacts/$id'),
        headers: await _headers(),
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'email': email,
          'relationship': relationship,
        }),
      );

      final data = jsonDecode(response.body);

      return response.statusCode == 200 && data['success'] == true;
    } catch (e) {
      print('Error updating contact: $e');
      return false;
    }
  }

  // DELETE EMERGENCY CONTACT
  static Future<bool> deleteContact(String id) async {
    try {
      final response = await _delete(
        Uri.parse('$baseUrl/contacts/$id'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      return data['success'] == true;
    } catch (e) {
      print('Error removing contact: $e');
      return false;
    }
  }

  // SEARCH PLACES
  static Future<List<Map<String, dynamic>>> searchPlaces(
    String query,
    double lat,
    double lng,
  ) async {
    if (query.trim().isEmpty) return [];

    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/search'
        '?q=${Uri.encodeComponent(query)}'
        '&format=json'
        '&limit=6'
        '&lat=$lat'
        '&lon=$lng'
        '&addressdetails=1',
      );

      final response = await _get(
        url,
        headers: {
          'User-Agent': 'TravelSafetySOS/1.0 (com.travelsafetysos.mobile)',
          'Accept': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);

        return data.map<Map<String, dynamic>>((item) {
          return {
            'name': item['display_name'] ?? 'Unknown place',
            'lat': double.tryParse(item['lat']?.toString() ?? '') ?? 0.0,
            'lng': double.tryParse(item['lon']?.toString() ?? '') ?? 0.0,
          };
        }).toList();
      }
    } catch (e) {
      print('Error searching places: $e');
    }

    return [];
  }

  // GET USER PROFILE
  static Future<Map<String, dynamic>?> getUserProfile() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/auth/me'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return data['data'];
      }
    } catch (e) {
      print('Error getting user profile: $e');
    }

    return null;
  }

  // UPDATE USER LOCATION
  static Future<void> updateUserLocation(
    double latitude,
    double longitude,
  ) async {
    try {
      await _put(
        Uri.parse('$baseUrl/auth/location'),
        headers: await _headers(),
        body: jsonEncode({'latitude': latitude, 'longitude': longitude}),
      );
    } catch (e) {
      print('Error updating user active location: $e');
    }
  }

  // RESPOND TO SOS
  static Future<Map<String, dynamic>> respondToSOS(String alertId) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/alerts/$alertId/respond'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'data': data['data']};
      }

      return {
        'success': false,
        'message': data['message'] ?? 'Failed to mark as responding',
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // UPDATE USER PROFILE
  static Future<Map<String, dynamic>> updateUserProfile({
    required String name,
    required String phone,
    required String gender,
    required String bloodGroup,
    required String dob,
  }) async {
    try {
      final response = await _put(
        Uri.parse('$baseUrl/auth/profile'),
        headers: await _headers(),
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'gender': gender,
          'bloodGroup': bloodGroup,
          'dob': dob,
        }),
      );

      final data = jsonDecode(response.body);

      return {
        'success': response.statusCode == 200 && data['success'] == true,
        'message': data['message'] ?? 'Profile update failed',
        'data': data['data'],
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // CHANGE PASSWORD
  static Future<Map<String, dynamic>> changePassword(
    String oldPassword,
    String newPassword,
  ) async {
    try {
      final response = await _put(
        Uri.parse('$baseUrl/auth/change-password'),
        headers: await _headers(),
        body: jsonEncode({
          'oldPassword': oldPassword,
          'newPassword': newPassword,
        }),
      );

      final data = jsonDecode(response.body);

      return {
        'success': response.statusCode == 200 && data['success'] == true,
        'message': data['message'] ?? 'Password update failed',
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // DELETE ACCOUNT
  static Future<Map<String, dynamic>> deleteAccount() async {
    try {
      final response = await _delete(
        Uri.parse('$baseUrl/auth/delete-account'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      return {
        'success': response.statusCode == 200 && data['success'] == true,
        'message': data['message'] ?? 'Delete account failed',
      };
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // GET JOURNEY HISTORY
  static Future<List<dynamic>> getJourneyHistory() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/journey/history'),
        headers: await _headers(),
      );

      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        return data['data'] ?? [];
      }
    } catch (e) {
      print('Error getting journey history: $e');
    }

    return [];
  }
}
