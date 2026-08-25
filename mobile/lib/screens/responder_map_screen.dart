import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class ResponderMapScreen extends StatefulWidget {
  final String alertId;
  final String dangerUserName;
  final String dangerUserPhone;
  final double latitude;
  final double longitude;

  const ResponderMapScreen({
    super.key,
    required this.alertId,
    required this.dangerUserName,
    required this.dangerUserPhone,
    required this.latitude,
    required this.longitude,
  });

  @override
  State<ResponderMapScreen> createState() => _ResponderMapScreenState();
}

class _ResponderMapScreenState extends State<ResponderMapScreen> {
  final MapController _mapController = MapController();
  bool _responding = false;
  bool _submitting = false;
  String _address = 'Resolving location address...';
  bool _loadingAddress = true;

  @override
  void initState() {
    super.initState();
    _fetchReverseGeocode();
    
    // Listen for SOS resolved socket notification
    final prevSosResolved = SocketService.onSosResolved;
    SocketService.onSosResolved = (data) {
      if (prevSosResolved != null) prevSosResolved(data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Emergency SOS was resolved by user.'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.maybePop(context);
      }
    };
  }

  Future<void> _fetchReverseGeocode() async {
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=${widget.latitude}&lon=${widget.longitude}',
      );
      final response = await http.get(url, headers: {
        'User-Agent': 'TravelSafetySOS/1.0 (com.travelsafetysos.mobile)',
      }).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final displayName = data['display_name']?.toString() ?? 'Location resolved';
        if (mounted) {
          setState(() {
            _address = displayName;
            _loadingAddress = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _address = 'Coordinates: ${widget.latitude.toStringAsFixed(5)}°, ${widget.longitude.toStringAsFixed(5)}°';
            _loadingAddress = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _address = 'Coordinates: ${widget.latitude.toStringAsFixed(5)}°, ${widget.longitude.toStringAsFixed(5)}°';
          _loadingAddress = false;
        });
      }
    }
  }

  Future<void> _openExternalMap() async {
    final googleMapsUrl = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${widget.latitude},${widget.longitude}',
    );
    final geoUrl = Uri.parse(
      'geo:${widget.latitude},${widget.longitude}?q=${widget.latitude},${widget.longitude}',
    );
    try {
      if (await canLaunchUrl(googleMapsUrl)) {
        await launchUrl(googleMapsUrl, mode: LaunchMode.externalApplication);
        return;
      }
      if (await canLaunchUrl(geoUrl)) {
        await launchUrl(geoUrl, mode: LaunchMode.externalApplication);
        return;
      }
      // Fallback try direct launch without canLaunchUrl pre-check
      final launched = await launchUrl(googleMapsUrl, mode: LaunchMode.externalApplication);
      if (!launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to open external map application.')),
        );
      }
    } catch (e) {
      print('Error launching external map: $e');
      try {
        await launchUrl(googleMapsUrl, mode: LaunchMode.platformDefault);
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Unable to open external map application.')),
          );
        }
      }
    }
  }

  Future<void> _markResponding() async {
    setState(() {
      _submitting = true;
    });

    try {
      final res = await ApiService.respondToSOS(widget.alertId);
      if (res['success'] == true) {
        setState(() {
          _responding = true;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Status updated! You are marked as responding.'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed: ${res['message']}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
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
    const dangerColor = Color(0xFFEF4444);
    const successColor = Color(0xFF10B981);
    const accentColor = Color(0xFF3B82F6);
    final targetLatLng = LatLng(widget.latitude, widget.longitude);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        title: const Text('🚨 Emergency Response Map', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: cardColor,
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Header Card with info
          Container(
            color: cardColor,
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: dangerColor, size: 32),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${widget.dangerUserName} needs help!',
                            style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
                          ),
                          if (widget.dangerUserPhone.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              'Phone: ${widget.dangerUserPhone}',
                              style: const TextStyle(color: Colors.grey, fontSize: 13, fontFamily: 'monospace'),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Lat/Lng Coordinates Badge & Reverse Geocoded Address
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: bgColor,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.gps_fixed, color: accentColor, size: 16),
                          const SizedBox(width: 6),
                          Text(
                            'GPS: ${widget.latitude.toStringAsFixed(5)}°, ${widget.longitude.toStringAsFixed(5)}°',
                            style: const TextStyle(
                              color: accentColor,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.location_on_outlined, color: Colors.grey, size: 16),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _loadingAddress
                                ? const Text('Fetching readable location address...', style: TextStyle(color: Colors.grey, fontSize: 12, fontStyle: FontStyle.italic))
                                : Text(_address, style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.3)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // Action Buttons Row
                Row(
                  children: [
                    Expanded(
                      flex: 6,
                      child: ElevatedButton.icon(
                        onPressed: (_responding || _submitting) ? null : _markResponding,
                        icon: _submitting 
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.directions_run, color: Colors.white, size: 20),
                        label: Text(
                          _responding ? 'RESPONDING' : 'I AM RESPONDING',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.5),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _responding ? successColor : dangerColor,
                          disabledBackgroundColor: _responding ? successColor.withOpacity(0.5) : cardColor.withOpacity(0.5),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 4,
                      child: OutlinedButton.icon(
                        onPressed: _openExternalMap,
                        icon: const Icon(Icons.navigation, color: accentColor, size: 18),
                        label: const Text(
                          'NAVIGATE',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: accentColor),
                        ),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: accentColor, width: 1.5),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Map View
          Expanded(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: targetLatLng,
                initialZoom: 15.0,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.travelsafetysos.mobile',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: targetLatLng,
                      width: 50,
                      height: 50,
                      child: const Stack(
                        alignment: Alignment.center,
                        children: [
                          Icon(Icons.location_on, color: dangerColor, size: 45),
                          Positioned(
                            top: 8,
                            child: Icon(Icons.person, color: Colors.white, size: 18),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
