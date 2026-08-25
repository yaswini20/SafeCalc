import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'home_screen.dart';

class JourneyScreen extends StatefulWidget {
  const JourneyScreen({super.key});

  @override
  State<JourneyScreen> createState() => _JourneyScreenState();
}

class _JourneyScreenState extends State<JourneyScreen> {
  final MapController _mapController = MapController();
  
  LatLng _currentPosition = const LatLng(13.2172, 79.1003); // Chittoor center default
  LatLng _destinationPosition = const LatLng(13.2172, 79.1003);
  
  final _destNameController = TextEditingController();
  final _vehicleController = TextEditingController();
  
  String _travelMode = 'Ola';
  double _radius = 200.0;
  int _durationMinutes = 15; // default 15 minutes trip
  
  bool _loadingLocation = true;
  bool _submitting = false;

  Timer? _debounceTimer;
  List<Map<String, dynamic>> _suggestions = [];
  bool _searchingPlaces = false;

  final List<Map<String, dynamic>> _mockSuggestions = [
    {'name': 'Bazar Street, Chittoor', 'lat': 13.2172, 'lng': 79.1003},
    {'name': 'OMR, Sholinganallur', 'lat': 12.9716, 'lng': 80.2454},
    {'name': 'Anna Nagar, Chennai', 'lat': 13.0850, 'lng': 80.2101},
    {'name': 'Giri Nagar, Chittoor', 'lat': 13.2201, 'lng': 79.1025},
  ];

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _destNameController.dispose();
    _vehicleController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounceTimer?.isActive ?? false) _debounceTimer!.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 600), () async {
      if (query.trim().isEmpty) {
        setState(() {
          _suggestions = [];
        });
        return;
      }
      setState(() {
        _searchingPlaces = true;
      });
      final results = await ApiService.searchPlaces(
        query,
        _currentPosition.latitude,
        _currentPosition.longitude,
      );
      setState(() {
        _suggestions = results;
        _searchingPlaces = false;
      });
    });
  }

  @override
  void initState() {
    super.initState();
    _fetchCurrentLocation();
  }

  Future<void> _fetchCurrentLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
        final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        setState(() {
          _currentPosition = LatLng(pos.latitude, pos.longitude);
          _destinationPosition = LatLng(pos.latitude, pos.longitude);
          _loadingLocation = false;
        });

        _mapController.move(_currentPosition, 14.0);
      } else {
        setState(() {
          _loadingLocation = false;
        });
      }
    } catch (e) {
      print('Location fetch failed: $e');
      setState(() {
        _loadingLocation = false;
      });
    }
  }

  void _selectSuggestion(Map<String, dynamic> suggestion) {
    final dest = LatLng(suggestion['lat'], suggestion['lng']);
    setState(() {
      _destNameController.text = suggestion['name'];
      _destinationPosition = dest;
    });

    _mapController.move(dest, 15.0);
  }

  Future<void> _startJourney() async {
    if (_destNameController.text.trim().isEmpty) return;

    setState(() {
      _submitting = true;
    });

    try {
      final destName = _destNameController.text.trim();
      final expectedReachTime = DateTime.now().add(Duration(minutes: _durationMinutes));

      // 1. Post start journey to Node backend
      final res = await ApiService.startJourney(
        destinationName: destName,
        destinationLatitude: _destinationPosition.latitude,
        destinationLongitude: _destinationPosition.longitude,
        destinationRadius: _radius,
        travelMode: _travelMode,
        vehicleNumber: _vehicleController.text.trim(),
        expectedReachTime: expectedReachTime,
        currentLatitude: _currentPosition.latitude,
        currentLongitude: _currentPosition.longitude,
      );

      if (res['success'] == true) {
        // 2. Spawn Native Android Foreground Tracking service
        final startedNative = await LocationServiceWrapper.startTracking(
          destLat: _destinationPosition.latitude,
          destLng: _destinationPosition.longitude,
          destRadius: _radius,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(startedNative ? 'Journey tracking active in foreground!' : 'Journey registered on server.'),
              backgroundColor: Colors.green,
            ),
          );
          
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const HomeScreen()),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to start journey: ${res['message']}'), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error starting journey: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFF080B11);
    const cardColor = Color(0xFF0F172A);
    const accentColor = Color(0xFF3B82F6);
    const textStyle = TextStyle(color: Colors.white, fontSize: 14);

    return Scaffold(
      backgroundColor: bgColor,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: const Text('Start Travel Journey', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: cardColor,
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: _loadingLocation
          ? const Center(child: CircularProgressIndicator(color: accentColor))
          : SingleChildScrollView(
              child: Column(
                children: [
                  // Destination search input panel
                  Container(
                    color: cardColor,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextField(
                          controller: _destNameController,
                          style: const TextStyle(color: Colors.white),
                          onChanged: _onSearchChanged,
                          decoration: InputDecoration(
                            hintText: 'Search destination...',
                            hintStyle: const TextStyle(color: Colors.grey),
                            filled: true,
                            fillColor: bgColor,
                            prefixIcon: const Icon(Icons.search, color: Colors.grey),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          ),
                        ),
                        if (_searchingPlaces)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 8.0),
                            child: Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: accentColor,
                                ),
                              ),
                            ),
                          ),
                        if (_suggestions.isNotEmpty)
                          Container(
                            constraints: const BoxConstraints(maxHeight: 180),
                            margin: const EdgeInsets.only(top: 8),
                            decoration: BoxDecoration(
                              color: bgColor,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.grey.withOpacity(0.2), width: 1),
                            ),
                            child: ListView.builder(
                              shrinkWrap: true,
                              physics: const ClampingScrollPhysics(),
                              itemCount: _suggestions.length,
                              itemBuilder: (context, index) {
                                final sug = _suggestions[index];
                                return ListTile(
                                  dense: true,
                                  title: Text(
                                    sug['name'],
                                    style: const TextStyle(color: Colors.white, fontSize: 13),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  leading: const Icon(Icons.location_on, color: accentColor, size: 18),
                                  onTap: () {
                                    _selectSuggestion(sug);
                                    setState(() {
                                      _suggestions = [];
                                    });
                                  },
                                );
                              },
                            ),
                          ),
                        if (_suggestions.isEmpty) ...[
                          const SizedBox(height: 8),
                          // Suggestion pills
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: _mockSuggestions.map((sug) {
                                return Padding(
                                  padding: const EdgeInsets.only(right: 8.0),
                                  child: ActionChip(
                                    label: Text(sug['name']),
                                    labelStyle: const TextStyle(fontSize: 12, color: Colors.white),
                                    backgroundColor: bgColor,
                                    onPressed: () => _selectSuggestion(sug),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ]
                      ],
                    ),
                  ),

                  // Map canvas using open-source flutter_map
                  SizedBox(
                    height: 260,
                    child: Stack(
                      children: [
                        FlutterMap(
                          mapController: _mapController,
                          options: MapOptions(
                            initialCenter: _destinationPosition,
                            initialZoom: 14.0,
                            onTap: (tapPosition, latlng) {
                              setState(() {
                                _destinationPosition = latlng;
                              });
                            },
                          ),
                          children: [
                            TileLayer(
                              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                              userAgentPackageName: 'com.travelsafetysos.mobile',
                            ),
                            CircleLayer(
                              circles: [
                                CircleMarker(
                                  point: _destinationPosition,
                                  radius: _radius,
                                  useRadiusInMeter: true,
                                  color: accentColor.withOpacity(0.15),
                                  borderColor: accentColor,
                                  borderStrokeWidth: 2,
                                ),
                              ],
                            ),
                            MarkerLayer(
                              markers: [
                                Marker(
                                  point: _destinationPosition,
                                  width: 40,
                                  height: 40,
                                  child: const Icon(
                                    Icons.location_on,
                                    size: 40,
                                    color: Colors.pink,
                                  ),
                                ),
                                Marker(
                                  point: _currentPosition,
                                  width: 30,
                                  height: 30,
                                  child: const Icon(
                                    Icons.my_location,
                                    size: 24,
                                    color: Colors.blueAccent,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        
                        // Map instructions indicator
                        Positioned(
                          top: 12,
                          left: 12,
                          right: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                            decoration: BoxDecoration(
                              color: bgColor.withOpacity(0.85),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.white.withOpacity(0.1)),
                            ),
                            child: const Text(
                              '💡 Tap anywhere on the map to change the destination location.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey, fontSize: 11),
                            ),
                          ),
                        )
                      ],
                    ),
                  ),

                  // Settings controls
                  Container(
                    color: cardColor,
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Mode & Vehicle details
                        Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                dropdownColor: cardColor,
                                value: _travelMode,
                                style: textStyle,
                                decoration: const InputDecoration(labelText: 'Travel Mode'),
                                items: ['Ola', 'Uber', 'Rapido', 'Own Vehicle', 'Other'].map((mode) {
                                  return DropdownMenuItem<String>(value: mode, child: Text(mode));
                                }).toList(),
                                onChanged: (val) {
                                  setState(() {
                                    _travelMode = val!;
                                  });
                                },
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: TextField(
                                controller: _vehicleController,
                                style: textStyle,
                                decoration: const InputDecoration(
                                  labelText: 'Vehicle No. (e.g. TN 09 AB 1234)',
                                  labelStyle: TextStyle(color: Colors.grey, fontSize: 11),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Radius slider
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Geofence Radius:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                            Text('${_radius.toInt()}m', style: const TextStyle(color: accentColor, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        Slider(
                          min: 100,
                          max: 1000,
                          divisions: 9,
                          activeColor: accentColor,
                          value: _radius,
                          onChanged: (val) => setState(() => _radius = val),
                        ),
                        const SizedBox(height: 8),

                        // Travel reach timer slider
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Expected Duration:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                            Text('$_durationMinutes mins', style: const TextStyle(color: Colors.pinkAccent, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        Slider(
                          min: 5,
                          max: 120,
                          divisions: 23,
                          activeColor: Colors.pinkAccent,
                          value: _durationMinutes.toDouble(),
                          onChanged: (val) => setState(() => _durationMinutes = val.toInt()),
                        ),
                        const SizedBox(height: 16),

                        ElevatedButton(
                          onPressed: _submitting ? null : _startJourney,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blueAccent,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                          child: _submitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Text('Start Journey', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                        )
                      ],
                    ),
                  )
                ],
              ),
            ),
    );
  }
}
