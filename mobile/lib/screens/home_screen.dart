import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';
import '../services/location_service.dart';
import 'login_screen.dart';
import 'journey_screen.dart';
import 'contacts_screen.dart';
import 'geofence_screen.dart';
import 'mpin_checkin_screen.dart';
import 'responder_map_screen.dart';
import 'profile_screen.dart';
import 'package:geolocator/geolocator.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  // Navigation tabs
  int _currentTabIndex = 0;

  // SOS trigger state variables
  bool _sosActive = false;
  bool _countingDown = false;
  int _countdownSeconds = 5; // Default from mockup settings
  Timer? _countdownTimer;
  
  Map<String, dynamic>? _activeJourney;
  bool _loading = true;
  String _userName = 'Traveler';
  String _userId = '';
  
  // Coordinates telemetry display
  double _currLat = 0.0;
  double _currLng = 0.0;
  double _distanceToDest = 0.0;

  AnimationController? _rippleController;
  Timer? _locationUpdateTimer;
  List<Map<String, dynamic>> _incomingResponders = [];

  // History state variables
  List<dynamic> _historyJourneys = [];
  bool _historyLoading = false;

  @override
  void dispose() {
    _locationUpdateTimer?.cancel();
    _countdownTimer?.cancel();
    _rippleController?.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _rippleController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
    
    _initializeServices();
  }

  Future<void> _initializeServices() async {
    await ApiService.init();
    
    // Fetch profile info from local storage or server
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userName = prefs.getString('userName') ?? 'Traveler';
      _countdownSeconds = prefs.getInt('countdownDuration') ?? 5;
    });

    // Check active status on server
    await _syncActiveData();

    // Load initial history logs
    _loadHistory();

    // Initialize Native MethodChannel hooks
    await LocationServiceWrapper.init();
    
    LocationServiceWrapper.onLocationUpdate = (lat, lng, dist) {
      setState(() {
        _currLat = lat;
        _currLng = lng;
        _distanceToDest = dist;
      });
      // Push location changes to server
      ApiService.updateJourneyLocation(lat, lng);
    };

    LocationServiceWrapper.onGeofenceBreach = (lat, lng) {
      print('Native Geofence exit alert! Auto SOS trigger sequence active...');
      _dispatchSOS(triggerType: 'geofence_breach');
    };

    // Socket.io telemetry bindings
    if (_userId.isNotEmpty) {
      SocketService.connect(_userId);
      
      SocketService.onCheckInPrompt = (data) {
        print('Check-in prompt WebSocket received: $data');
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => MpinCheckinScreen(journeyId: data['journeyId'] ?? ''),
            ),
          );
        }
      };

      SocketService.onCheckInAlert = (data) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? 'Grace period active! Check-in required.'),
            backgroundColor: Colors.orange,
            duration: const Duration(seconds: 5),
          ),
        );
      };

      SocketService.onEmergencyEscalated = (data) {
        setState(() {
          _sosActive = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Safety timeout expired. Emergency escalated!'),
            backgroundColor: Colors.red,
          ),
        );
      };

      SocketService.onNearbySosAlert = (data) {
        print('Nearby SOS alert WebSocket received: $data');
        if (mounted) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              backgroundColor: const Color(0xFF0F172A),
              title: const Row(
                children: [
                  Icon(Icons.warning, color: Colors.red),
                  SizedBox(width: 8),
                  Text('🚨 NEIGHBOR SOS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ],
              ),
              content: Text(
                '${data['user']?['name'] ?? 'Someone'} needs help nearby! (within 1 km)',
                style: const TextStyle(color: Colors.white),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('DISMISS', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => ResponderMapScreen(
                          alertId: data['alertId'] ?? '',
                          dangerUserName: data['user']?['name'] ?? 'Someone',
                          dangerUserPhone: data['user']?['phone'] ?? '',
                          latitude: double.tryParse(data['latitude']?.toString() ?? '') ?? 0.0,
                          longitude: double.tryParse(data['longitude']?.toString() ?? '') ?? 0.0,
                        ),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  child: const Text('SHOW MAP', style: TextStyle(color: Colors.white)),
                ),
              ],
            ),
          );
        }
      };

      SocketService.onResponderUpdated = (data) {
        print('Responder update WebSocket received: $data');
        final resp = data['responder'];
        if (resp != null) {
          setState(() {
            if (!_incomingResponders.any((r) => r['id'] == resp['id'])) {
              _incomingResponders.add({
                'id': resp['id'],
                'name': resp['name'],
                'phone': resp['phone'],
              });
            }
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('🛡️ Neighbor ${resp['name']} is responding to your SOS!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      };

      SocketService.onSosResolved = (data) {
        print('SOS resolved WebSocket received: $data');
        if (mounted) {
          _syncActiveData();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Emergency SOS has been resolved.'),
              backgroundColor: Colors.green,
            ),
          );
        }
      };
    }

    _startPeriodicLocationUpdates();
  }

  Future<void> _startPeriodicLocationUpdates() async {
    _reportLocation();
    _locationUpdateTimer = Timer.periodic(const Duration(seconds: 40), (timer) {
      _reportLocation();
    });
  }

  Future<void> _reportLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      
      if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
        final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium);
        setState(() {
          _currLat = pos.latitude;
          _currLng = pos.longitude;
        });
        await ApiService.updateUserLocation(pos.latitude, pos.longitude);
      }
    } catch (e) {
      print('Error reporting periodic location: $e');
    }
  }

  Future<void> _syncActiveData() async {
    if (mounted) {
      setState(() {
        _loading = true;
      });
    }

    try {
      // Profile and active journey are independent requests. Loading them in
      // parallel makes the mobile dashboard much faster and avoids a long
      // serial wait when the hosted API is waking up.
      final results = await Future.wait<dynamic>([
        ApiService.getUserProfile(),
        ApiService.getActiveJourney(),
      ]);

      final profile = results[0] as Map<String, dynamic>?;
      final activeJ = results[1] as Map<String, dynamic>?;

      if (profile != null) {
        _userId = profile['_id']?.toString() ?? '';
        _userName = profile['name']?.toString() ?? 'Traveler';
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('userName', _userName);
      }

      if (!mounted) return;
      setState(() {
        _activeJourney = activeJ;
      if (activeJ != null) {
        _sosActive = activeJ['status'] == 'sos_triggered';
        _currLat = activeJ['currentLatitude'] ?? 0.0;
        _currLng = activeJ['currentLongitude'] ?? 0.0;
        
        if (_sosActive && activeJ['alert'] != null && activeJ['alert']['responders'] != null) {
          final List<dynamic> resps = activeJ['alert']['responders'];
          _incomingResponders = resps.map((r) => {
            'id': r['user']['_id'] ?? '',
            'name': r['user']['name'] ?? '',
            'phone': r['user']['phone'] ?? '',
          }).toList();
        }
        }
        _loading = false;
      });
    } catch (e) {
      print('Error syncing dashboard data: $e');
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadHistory() async {
    setState(() {
      _historyLoading = true;
    });
    final hist = await ApiService.getJourneyHistory();
    setState(() {
      _historyJourneys = hist;
      _historyLoading = false;
    });
  }

  void _toggleSOSButton() {
    if (_sosActive) {
      _resolveSOSAlert();
    } else {
      if (_countingDown) {
        _cancelCountdown();
      } else {
        _startSOSCountdown();
      }
    }
  }

  void _startSOSCountdown() {
    setState(() {
      _countingDown = true;
    });

    // Check saved countdown timer value
    SharedPreferences.getInstance().then((prefs) {
      setState(() {
        _countdownSeconds = prefs.getInt('countdownDuration') ?? 5;
      });
      
      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (_countdownSeconds > 1) {
          setState(() {
            _countdownSeconds--;
          });
        } else {
          _countdownTimer?.cancel();
          setState(() {
            _countingDown = false;
          });
          _dispatchSOS();
        }
      });
    });
  }

  void _cancelCountdown() {
    _countdownTimer?.cancel();
    setState(() {
      _countingDown = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('SOS Dispatch Canceled'), backgroundColor: Colors.blueGrey),
    );
  }

  Future<void> _dispatchSOS({String triggerType = 'manual_sos'}) async {
    setState(() {
      _sosActive = true;
    });
    try {
      await ApiService.triggerSOS(_currLat, _currLng, triggerType: triggerType);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('🚨 SOS Alert Dispatched to Guardians!'), backgroundColor: Colors.red),
      );
    } catch (e) {
      print('SOS error: $e');
    }
  }

  Future<void> _resolveSOSAlert() async {
    final controller = TextEditingController();
    final pin = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Verify MPIN'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          maxLength: 4,
          obscureText: true,
          decoration: const InputDecoration(labelText: '4-Digit MPIN'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Resolve SOS')),
        ],
      ),
    );
    // Do not dispose the dialog controller here. The dialog route may still
    // be completing its transition when showDialog returns; disposing it at
    // that moment can trigger Flutter's '_dependents.isEmpty' assertion.
    if (pin == null) return;
    if (!RegExp(r'^\d{4}$').hasMatch(pin)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid 4-digit MPIN.'), backgroundColor: Colors.red),
        );
      }
      return;
    }
    try {
      final result = await ApiService.resolveSOS(pin);
      if (result['success'] != true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result['message'] ?? 'Incorrect MPIN.'), backgroundColor: Colors.red),
          );
        }
        return;
      }
      setState(() {
        _sosActive = false;
      });
      await LocationServiceWrapper.stopTracking();
      await _syncActiveData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('SOS Alarm Resolved. All Safe.'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      print('Resolve error: $e');
    }
  }

  Future<void> _endJourney() async {
    final controller = TextEditingController();

    final mpin = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('End Travel', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          maxLength: 4,
          obscureText: true,
          style: const TextStyle(color: Colors.white, fontSize: 22, letterSpacing: 8),
          textAlign: TextAlign.center,
          decoration: const InputDecoration(
            labelText: 'Enter 4-digit MPIN',
            labelStyle: TextStyle(color: Colors.grey),
            counterText: '',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('CANCEL', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('END TRAVEL', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    // The dialog owns the TextField while its route is being removed.
    // Let the route finish before the controller is released.
    if (mpin == null) return;
    if (!RegExp(r'^\d{4}$').hasMatch(mpin)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid 4-digit MPIN.'), backgroundColor: Colors.red),
        );
      }
      return;
    }

    final result = await ApiService.endJourney(mpin);
    if (!mounted) return;

    if (result['success'] == true) {
      await LocationServiceWrapper.stopTracking();
      await _syncActiveData();
      await _loadHistory();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Journey Completed safely!'), backgroundColor: Colors.green),
        );
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Unable to end travel.'), backgroundColor: Colors.red),
      );
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return 'Good Morning 👋';
    if (hour >= 12 && hour < 17) return 'Good Afternoon 👋';
    if (hour >= 17 && hour < 21) return 'Good Evening 👋';
    return 'Good Night 👋';
  }

  // Dashboard view matching mockup
  Widget _buildDashboard() {
    const coralColor = Color(0xFFFF6D6D);
    const dangerColor = Color(0xFFEF4444);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Greeting Header row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _getGreeting(),
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Stay safe. We\'re here for you.',
                    style: TextStyle(fontSize: 14, color: Colors.white.withOpacity(0.5)),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const ProfileScreen()),
                  );
                  _syncActiveData();
                },
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFF8A8A),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.person, color: Colors.white, size: 24),
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),

          // Safe Banner Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            decoration: BoxDecoration(
              color: _sosActive ? const Color(0xFF3D1B1B) : const Color(0xFFE9F7F2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: _sosActive ? Colors.red.withOpacity(0.2) : const Color(0xFFC8E6C9),
                  radius: 24,
                  child: Icon(
                    _sosActive ? Icons.warning : Icons.security,
                    color: _sosActive ? Colors.redAccent : const Color(0xFF2E7D32),
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _sosActive ? 'Emergency Alert!' : 'You\'re Safe',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: _sosActive ? Colors.redAccent : const Color(0xFF1B5E20),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _sosActive ? 'Rescue coordination active.' : 'No active emergency',
                        style: TextStyle(
                          fontSize: 13,
                          color: _sosActive ? Colors.redAccent.withOpacity(0.8) : const Color(0xFF388E3C),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          // SOS Dispatch Section
          const Text(
            'Emergency',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _toggleSOSButton,
            child: Container(
              height: 90,
              decoration: BoxDecoration(
                color: _sosActive ? dangerColor : (_countingDown ? Colors.amber : coralColor),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: (_sosActive ? dangerColor : coralColor).withOpacity(0.2),
                    blurRadius: 10,
                    spreadRadius: 2,
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: _countingDown
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        ),
                        const SizedBox(width: 16),
                        Text(
                          'Sending SOS in $_countdownSeconds seconds (Tap to Cancel)',
                          style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                      ],
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _sosActive ? Icons.check_circle_outline : Icons.warning_amber_rounded,
                          color: Colors.white,
                          size: 32,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          _sosActive ? 'RESOLVE SOS' : 'SOS',
                          style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 32),

          // Rescue coordination en-route logs
          if (_sosActive && _incomingResponders.isNotEmpty) ...[
            const Text(
              'Rescue Coordination Logs',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 12),
            ..._incomingResponders.map((resp) {
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.green.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shield, color: Colors.green),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(resp['name'] ?? 'Responder', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          Text('Phone: ${resp['phone']}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                        ],
                      ),
                    ),
                    const Text('EN ROUTE', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 11)),
                  ],
                ),
              );
            }).toList(),
            const SizedBox(height: 24),
          ],

          // Current Journey Section
          const Text(
            'Current Journey',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 12),

          if (_activeJourney == null)
            GestureDetector(
              onTap: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const JourneyScreen()),
                );
                _syncActiveData();
              },
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A1E),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFE8E8),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.location_on, color: coralColor, size: 28),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'No active journey',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Start a journey when you\'re travelling',
                            style: TextStyle(color: Colors.grey, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: Colors.grey),
                  ],
                ),
              ),
            )
          else
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.06)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Destination: ${_activeJourney!['destinationName']}',
                    style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Text('Mode: ${_activeJourney!['travelMode']}', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                      if (_activeJourney!['vehicleNumber'] != null) ...[
                        const SizedBox(width: 16),
                        Text('Vehicle: ${_activeJourney!['vehicleNumber']}', style: const TextStyle(color: Colors.grey, fontSize: 13, fontFamily: 'monospace')),
                      ]
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Grace expires: ${new DateFormat("hh:mm a").format(DateTime.parse(_activeJourney!['gracePeriodEndsAt']))}',
                    style: const TextStyle(color: Colors.orangeAccent, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _dispatchSOS(triggerType: 'manual_sos'),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: dangerColor),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('Force SOS Alert', style: TextStyle(color: dangerColor)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _endJourney,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('End Travel', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  )
                ],
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  // History tab view
  Widget _buildHistoryTab() {
    const coralColor = Color(0xFFFF6D6D);
    if (_historyLoading) {
      return const Center(child: CircularProgressIndicator(color: coralColor));
    }

    if (_historyJourneys.isEmpty) {
      return const Center(
        child: Text(
          'No travel history logs recorded.',
          style: TextStyle(color: Colors.grey, fontSize: 14),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _historyJourneys.length,
      itemBuilder: (context, index) {
        final j = _historyJourneys[index];
        final created = DateTime.parse(j['createdAt']);
        final formattedDate = "${created.year}-${created.month.toString().padLeft(2, '0')}-${created.day.toString().padLeft(2, '0')}";
        final status = j['status'] ?? 'completed';

        return Card(
          color: const Color(0xFF1E1E1E),
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            title: Text(
              j['destinationName'] ?? 'Journey',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 4),
                Text('Date: $formattedDate  |  Mode: ${j['travelMode'] ?? 'N/A'}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                if (j['vehicleNumber'] != null && j['vehicleNumber'].isNotEmpty)
                  Text('Vehicle: ${j['vehicleNumber']}', style: const TextStyle(color: Colors.grey, fontSize: 12, fontFamily: 'monospace')),
              ],
            ),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: status == 'completed' ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                border: Border.all(color: status == 'completed' ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2)),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                status.toUpperCase(),
                style: TextStyle(
                  color: status == 'completed' ? Colors.green : Colors.red,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFF121212);
    const coralColor = Color(0xFFFF6D6D);

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: _loading && _currentTabIndex == 0
            ? const Center(child: CircularProgressIndicator(color: coralColor))
            : IndexedStack(
                index: _currentTabIndex,
                children: [
                  _buildDashboard(),
                  const GeofenceScreen(),
                  _buildHistoryTab(),
                ],
              ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTabIndex,
        backgroundColor: const Color(0xFF1E1E1E),
        selectedItemColor: coralColor,
        unselectedItemColor: Colors.grey,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
        unselectedLabelStyle: const TextStyle(fontSize: 12),
        onTap: (index) {
          setState(() {
            _currentTabIndex = index;
          });
          if (index == 2) {
            _loadHistory();
          } else if (index == 0) {
            _syncActiveData();
          }
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.shield_outlined),
            activeIcon: Icon(Icons.shield),
            label: 'SafeZone',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.location_on_outlined),
            activeIcon: Icon(Icons.location_on),
            label: 'Geofence',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history_toggle_off),
            activeIcon: Icon(Icons.history),
            label: 'History',
          ),
        ],
      ),
    );
  }
}

// Simple Helper for Date Formatting inside files
class DateFormat {
  final String formatPattern;
  DateFormat(this.formatPattern);

  String format(DateTime date) {
    final hour = date.hour;
    final min = date.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
    return "$displayHour:$min $period";
  }
}

// wait! _toggleSOSButton calls resolve if active, or starts countdown if not active. This is extremely robust.
