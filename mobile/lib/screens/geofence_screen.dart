import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';

class GeofenceScreen extends StatefulWidget {
  const GeofenceScreen({super.key});

  @override
  State<GeofenceScreen> createState() => _GeofenceScreenState();
}

class _GeofenceScreenState extends State<GeofenceScreen> {
  List<dynamic> _safePlaces = [];
  bool _loading = true;

  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _latController = TextEditingController();
  final _lngController = TextEditingController();
  double _radius = 200.0;

  @override
  void initState() {
    super.initState();
    _loadSafePlaces();
  }

  Future<void> _loadSafePlaces() async {
    setState(() {
      _loading = true;
    });
    final places = await ApiService.getSafePlaces();
    setState(() {
      _safePlaces = places;
      _loading = false;
    });
  }

  Future<void> _getCurrentLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permission denied')),
          );
          return;
        }
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      setState(() {
        _latController.text = position.latitude.toStringAsFixed(6);
        _lngController.text = position.longitude.toStringAsFixed(6);
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Current location populated!'), backgroundColor: Colors.blue),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error getting coordinates: $e'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _saveSafePlace() async {
    if (!_formKey.currentState!.validate()) return;

    final name = _nameController.text.trim();
    final lat = double.parse(_latController.text);
    final lng = double.parse(_lngController.text);

    final success = await ApiService.addSafePlace(name, lat, lng, _radius);
    if (success) {
      _nameController.clear();
      _latController.clear();
      _lngController.clear();
      setState(() {
        _radius = 200.0;
      });
      _loadSafePlaces();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Safe zone saved!'), backgroundColor: Colors.green),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save safe place'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _deletePlace(String id) async {
    final success = await ApiService.deleteSafePlace(id);
    if (success) {
      _loadSafePlaces();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Safe zone deleted'), backgroundColor: Colors.orange),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFF080B11);
    const cardColor = Color(0xFF0F172A);
    const accentColor = Color(0xFF10B981); // Emerald green for safe zones

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        title: const Text('Safe Places / Geofences', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: cardColor,
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: accentColor))
          : Column(
              children: [
                // Add Form
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: cardColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.05)),
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'DEFINE SAFE ZONE GEOFENCE',
                            style: TextStyle(
                              color: Colors.grey,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.5,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _nameController,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: const InputDecoration(
                              labelText: 'Geofence Label',
                              labelStyle: TextStyle(color: Colors.grey),
                              prefixIcon: Icon(Icons.label_outline, color: Colors.grey),
                            ),
                            validator: (val) => val!.isEmpty ? 'Label required' : null,
                          ),
                          const SizedBox(height: 12),
                          
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _latController,
                                  style: const TextStyle(color: Colors.white, fontSize: 14, fontFamily: 'monospace'),
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  decoration: const InputDecoration(
                                    labelText: 'Latitude',
                                    labelStyle: TextStyle(color: Colors.grey),
                                  ),
                                  validator: (val) => double.tryParse(val!) == null ? 'Invalid value' : null,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _lngController,
                                  style: const TextStyle(color: Colors.white, fontSize: 14, fontFamily: 'monospace'),
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  decoration: const InputDecoration(
                                    labelText: 'Longitude',
                                    labelStyle: TextStyle(color: Colors.grey),
                                  ),
                                  validator: (val) => double.tryParse(val!) == null ? 'Invalid value' : null,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          OutlinedButton.icon(
                            onPressed: _getCurrentLocation,
                            icon: const Icon(Icons.my_location, size: 16, color: Colors.blueAccent),
                            label: const Text('Use Current Location', style: TextStyle(color: Colors.blueAccent)),
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Colors.blueAccent),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Radius Slider
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Safe Radius:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                              Text(
                                '${_radius.toInt()}m',
                                style: const TextStyle(color: accentColor, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          Slider(
                            min: 50.0,
                            max: 1500.0,
                            divisions: 29,
                            activeColor: accentColor,
                            inactiveColor: const Color(0xFF1E293B),
                            value: _radius,
                            onChanged: (val) {
                              setState(() {
                                _radius = val;
                              });
                            },
                          ),
                          const SizedBox(height: 12),

                          ElevatedButton(
                            onPressed: _saveSafePlace,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: accentColor,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: const Text('Save Safe Place', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          )
                        ],
                      ),
                    ),
                  ),
                ),

                // Geofences list
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    child: _safePlaces.isEmpty
                        ? const Center(
                            child: Text(
                              'No static geofences configured. Save safe places to monitor exit alerts.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey, fontSize: 13),
                            ),
                          )
                        : ListView.builder(
                            itemCount: _safePlaces.length,
                            itemBuilder: (context, index) {
                              final place = _safePlaces[index];
                              return Card(
                                color: cardColor,
                                margin: const EdgeInsets.only(bottom: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: BorderSide(color: Colors.white.withOpacity(0.03)),
                                ),
                                child: ListTile(
                                  leading: const CircleAvatar(
                                    backgroundColor: Color(0x1010B981),
                                    child: Icon(Icons.location_on, color: accentColor),
                                  ),
                                  title: Text(
                                    place['name'] ?? '',
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                  ),
                                  subtitle: Text(
                                    'Coords: (${place['latitude']}, ${place['longitude']})\nRadius: ${place['radius']}m',
                                    style: const TextStyle(color: Colors.grey, fontSize: 12, height: 1.3),
                                  ),
                                  trailing: IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.grey),
                                    onPressed: () => _deletePlace(place['_id']),
                                  ),
                                  isThreeLine: true,
                                ),
                              );
                            },
                          ),
                  ),
                )
              ],
            ),
    );
  }
}
