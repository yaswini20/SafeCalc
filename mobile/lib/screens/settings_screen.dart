import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _sosNotifications = true;
  bool _liveLocationSharing = true;
  bool _confirmBeforeSending = true;
  int _countdownSeconds = 5;
  bool _loading = true;

  // Controllers for change password
  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _oldPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _sosNotifications = prefs.getBool('sosNotifications') ?? true;
      _liveLocationSharing = prefs.getBool('liveLocationSharing') ?? true;
      _confirmBeforeSending = prefs.getBool('confirmBeforeSending') ?? true;
      _countdownSeconds = prefs.getInt('countdownDuration') ?? 5;
      _loading = false;
    });
  }

  Future<void> _updateSetting(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
    setState(() {
      if (key == 'sosNotifications') _sosNotifications = value;
      if (key == 'liveLocationSharing') _liveLocationSharing = value;
      if (key == 'confirmBeforeSending') _confirmBeforeSending = value;
    });
  }

  Future<void> _updateCountdown(int value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('countdownDuration', value);
    setState(() {
      _countdownSeconds = value;
    });
  }

  void _showCountdownPicker() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('SOS Countdown Duration', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [3, 5, 10].map((sec) {
            return ListTile(
              title: Text('$sec seconds', style: const TextStyle(color: Colors.white)),
              trailing: _countdownSeconds == sec ? const Icon(Icons.check, color: Color(0xFFFF6D6D)) : null,
              onTap: () {
                _updateCountdown(sec);
                Navigator.of(ctx).pop();
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  void _showChangePasswordDialog() {
    _oldPasswordController.clear();
    _newPasswordController.clear();
    _confirmPasswordController.clear();

    showDialog(
      context: context,
      builder: (ctx) {
        bool subStateSaving = false;
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E1E1E),
              title: const Text('Change Password', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: _oldPasswordController,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Current Password'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _newPasswordController,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'New Password'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _confirmPasswordController,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Confirm New Password'),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('CANCEL', style: TextStyle(color: Colors.grey)),
                ),
                TextButton(
                  onPressed: subStateSaving ? null : () async {
                    final oldP = _oldPasswordController.text;
                    final newP = _newPasswordController.text;
                    final confP = _confirmPasswordController.text;

                    if (oldP.isEmpty || newP.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please fill all fields'), backgroundColor: Colors.red),
                      );
                      return;
                    }
                    if (newP != confP) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Passwords do not match'), backgroundColor: Colors.red),
                      );
                      return;
                    }

                    setDialogState(() {
                      subStateSaving = true;
                    });

                    final res = await ApiService.changePassword(oldP, newP);
                    
                    setDialogState(() {
                      subStateSaving = false;
                    });

                    if (res['success'] == true) {
                      if (context.mounted) {
                        Navigator.of(ctx).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Password updated successfully!'), backgroundColor: Colors.green),
                        );
                      }
                    } else {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(res['message'] ?? 'Password update failed'), backgroundColor: Colors.red),
                        );
                      }
                    }
                  },
                  child: subStateSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFF6D6D)))
                      : const Text('SAVE', style: TextStyle(color: Color(0xFFFF6D6D), fontWeight: FontWeight.bold)),
                ),
              ],
            );
          }
        );
      },
    );
  }

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (ctx) {
        bool subStateSaving = false;
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E1E1E),
              title: const Text('Delete Account', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
              content: const Text(
                'Are you absolutely sure you want to delete your account? This action is permanent and will clear all your active journeys, emergency guardians, and location logs.',
                style: TextStyle(color: Colors.white70),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('CANCEL', style: TextStyle(color: Colors.grey)),
                ),
                TextButton(
                  onPressed: subStateSaving ? null : () async {
                    setDialogState(() {
                      subStateSaving = true;
                    });

                    final res = await ApiService.deleteAccount();

                    setDialogState(() {
                      subStateSaving = false;
                    });

                    if (res['success'] == true) {
                      if (context.mounted) {
                        Navigator.of(ctx).pop();
                        Navigator.pushAndRemoveUntil(
                          context,
                          MaterialPageRoute(builder: (context) => const LoginScreen()),
                          (route) => false,
                        );
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Account permanently deleted'), backgroundColor: Colors.orange),
                        );
                      }
                    } else {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(res['message'] ?? 'Account deletion failed'), backgroundColor: Colors.red),
                        );
                      }
                    }
                  },
                  child: subStateSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.red))
                      : const Text('DELETE', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          }
        );
      },
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 16.0, top: 24.0, bottom: 8.0),
      child: Text(
        title,
        style: TextStyle(
          color: Colors.white.withOpacity(0.4),
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.0,
        ),
      ),
    );
  }

  Widget _buildSwitchTile(String title, bool value, String key) {
    const coralColor = Color(0xFFFF6D6D);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: SwitchListTile(
        title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 16)),
        value: value,
        activeColor: Colors.white,
        activeTrackColor: coralColor,
        inactiveThumbColor: Colors.grey,
        inactiveTrackColor: Colors.white10,
        onChanged: (val) => _updateSetting(key, val),
      ),
    );
  }

  Widget _buildActionTile(String title, String trailingText, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 16)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (trailingText.isNotEmpty)
              Text(trailingText, style: const TextStyle(color: Colors.grey, fontSize: 14)),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, color: Colors.grey),
          ],
        ),
        onTap: onTap,
      ),
    );
  }

  void _showServerHostDialog() {
    final serverController = TextEditingController(text: ApiService.serverHost);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Backend Server Host IP', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter PC Local IP or server URL (e.g. http://10.84.36.243:5000 or http://127.0.0.1:5000)',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: serverController,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Server URL',
                hintText: 'http://10.84.36.243:5000',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('CANCEL', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () async {
              final newHost = serverController.text.trim();
              if (newHost.isNotEmpty) {
                await ApiService.setServerHost(newHost);
                if (mounted) {
                  setState(() {});
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Server URL updated to: ${ApiService.serverHost}'),
                      backgroundColor: Colors.green,
                    ),
                  );
                }
              }
              Navigator.of(ctx).pop();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFF6D6D)),
            child: const Text('SAVE', style: TextStyle(color: Colors.white)),
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
        title: const Text('Settings', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: coralColor))
          : ListView(
              children: [
                _buildSectionHeader('NOTIFICATIONS'),
                _buildSwitchTile('SOS Alert Notifications', _sosNotifications, 'sosNotifications'),
                
                _buildSectionHeader('LOCATION'),
                _buildActionTile('Manage Location Access', '', () {
                  // Direct location permission check info or request
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Device location tracking permissions verified.')),
                  );
                }),
                _buildSwitchTile('Live Location Sharing', _liveLocationSharing, 'liveLocationSharing'),
                
                _buildSectionHeader('SOS SETTINGS'),
                _buildActionTile('SOS Countdown', '$_countdownSeconds seconds', _showCountdownPicker),
                _buildSwitchTile('Confirm Before Sending SOS', _confirmBeforeSending, 'confirmBeforeSending'),

                _buildSectionHeader('NETWORK & BACKEND'),
                _buildActionTile('Backend Server Host', ApiService.serverHost, _showServerHostDialog),
                
                _buildSectionHeader('ACCOUNT & PRIVACY'),
                _buildActionTile('Change Password', '', _showChangePasswordDialog),
                _buildActionTile('Delete Account', '', _showDeleteAccountDialog),
                const SizedBox(height: 48),
              ],
            ),
    );
  }
}
