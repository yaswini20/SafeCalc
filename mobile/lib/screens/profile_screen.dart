import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'personal_details_screen.dart';
import 'contacts_screen.dart';
import 'settings_screen.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;
  List<dynamic> _contacts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadProfileAndContacts();
  }

  Future<void> _loadProfileAndContacts() async {
    if (mounted) {
      setState(() {
        _loading = true;
      });
    }

    try {
      // Load both resources together so the profile page does not wait for
      // contacts before displaying the user's profile information.
      final results = await Future.wait<dynamic>([
        ApiService.getUserProfile(),
        ApiService.getContacts(),
      ]);

      if (!mounted) return;
      setState(() {
        _profile = results[0] as Map<String, dynamic>?;
        _contacts = results[1] as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      print('Error loading profile page data: $e');
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _handleLogout() async {
    await ApiService.logout();
    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  void _showHowItWorks() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('How It Works', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const SingleChildScrollView(
          child: Text(
            'TravelSafetySOS is a unified safety companion designed to protect you during trips:\n\n'
            '1. Set up to 3 trusted contacts (guardians) who will receive alerts.\n\n'
            '2. Plan a journey by setting a destination and geofence boundary.\n\n'
            '3. If you leave the geofence boundary or exceed the journey arrival timer without checking in via your secure MPIN, an emergency alert is triggered.\n\n'
            '4. During an emergency, your real-time location is shared with your guardians and nearby responders.',
            style: TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('GOT IT', style: TextStyle(color: Color(0xFFFF6D6D), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
          ),
          const SizedBox(height: 4),
          Text(
            value.isNotEmpty ? value : 'Not Specified',
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w400),
          ),
        ],
      ),
    );
  }

  Widget _buildContactRow(String role, String name, String phone) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            backgroundColor: Color(0x15FF6D6D),
            radius: 20,
            child: Icon(Icons.person_outline, color: Color(0xFFFF6D6D)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  role,
                  style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
                ),
                const SizedBox(height: 2),
                Text(
                  name,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 2),
                Text(
                  phone,
                  style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFF121212);
    const coralColor = Color(0xFFFF6D6D);

    return Scaffold(
      backgroundColor: bgColor,
      appBar: AppBar(
        title: const Text('MY PROFILE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500, letterSpacing: 0.5)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: coralColor))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: Column(
                children: [
                  // Profile Avatar
                  Center(
                    child: Column(
                      children: [
                        Container(
                          width: 100,
                          height: 100,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFFBABA),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.person, size: 60, color: Colors.white),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _profile?['name'] ?? 'yaswini',
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w500, color: Colors.white),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _profile?['email'] ?? 'poornima.v@gmail.com',
                          style: TextStyle(fontSize: 14, color: Colors.white.withOpacity(0.5)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 36),

                  // Personal Details Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.person_outline, color: Colors.blueAccent, size: 24),
                          SizedBox(width: 8),
                          Text(
                            'Personal Details',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit, color: coralColor, size: 20),
                        onPressed: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const PersonalDetailsScreen()),
                          );
                          _loadProfileAndContacts();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildDetailRow('Username', _profile?['name'] ?? ''),
                  _buildDetailRow('Email', _profile?['email'] ?? ''),
                  _buildDetailRow('Phone Number', _profile?['phone'] ?? ''),
                  _buildDetailRow('Gender', _profile?['gender'] ?? ''),
                  _buildDetailRow('Blood Group', _profile?['bloodGroup'] ?? ''),
                  _buildDetailRow('Date of Birth', _profile?['dob'] ?? ''),
                  const SizedBox(height: 24),

                  // Emergency Contacts Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.notifications_active_outlined, color: Colors.amber, size: 24),
                          SizedBox(width: 8),
                          Text(
                            'Emergency Contacts',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit, color: coralColor, size: 20),
                        onPressed: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const ContactsScreen()),
                          );
                          _loadProfileAndContacts();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_contacts.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E1E1E),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'No emergency contacts configured yet.',
                        style: TextStyle(color: Colors.grey, fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                    )
                  else
                    ...List.generate(_contacts.length, (index) {
                      final c = _contacts[index];
                      return _buildContactRow('Contact ${index + 1}', c['name'] ?? '', c['phone'] ?? '');
                    }),
                  const SizedBox(height: 36),

                  // Settings Button Link
                  InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const SettingsScreen()),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E1E1E),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.settings, color: coralColor),
                          SizedBox(width: 12),
                          Text(
                            'Settings',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // How It Works Title Card
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E1E),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.help_outline, color: coralColor),
                        SizedBox(width: 12),
                        Text(
                          'How It Works',
                          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Large How It Works description details card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E1E),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      children: [
                        _buildHowItWorksItem(1, 'SafeZone', 'Use the SOS button directly from the main screen when you are in danger. The countdown gives you time to cancel before the SOS is activated.'),
                        const SizedBox(height: 20),
                        _buildHowItWorksItem(2, 'Geofence', 'Save important places such as Home, College, or Office as safe places.'),
                        const SizedBox(height: 20),
                        _buildHowItWorksItem(3, 'Journey', 'Start a one-time journey when travelling to a destination. The app can monitor the journey and location status.'),
                        const SizedBox(height: 20),
                        _buildHowItWorksItem(4, 'SOS', 'When SOS is activated, the emergency process can use your saved emergency contacts and location information.'),
                        const SizedBox(height: 20),
                        _buildHowItWorksItem(5, 'History', 'View previous safety activity, journeys, and emergency-related events in the History section.'),
                        const SizedBox(height: 20),
                        _buildHowItWorksItem(6, 'Privacy', 'Your profile and safety information are associated with your account and stored securely.'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Log Out Button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton.icon(
                      onPressed: _handleLogout,
                      icon: const Icon(Icons.logout, color: Colors.white),
                      label: const Text('Log Out', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: coralColor,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12.0),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }

  Widget _buildHowItWorksItem(int number, String title, String description) {
    const coralColor = Color(0xFFFF6D6D);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          backgroundColor: coralColor,
          radius: 16,
          child: Text(
            '$number',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13, height: 1.3),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
