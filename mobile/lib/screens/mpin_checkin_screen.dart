import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'home_screen.dart';

class MpinCheckinScreen extends StatefulWidget {
  final String journeyId;
  const MpinCheckinScreen({super.key, required this.journeyId});

  @override
  State<MpinCheckinScreen> createState() => _MpinCheckinScreenState();
}

class _MpinCheckinScreenState extends State<MpinCheckinScreen> {
  final _pinController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  
  int _secondsRemaining = 300; // 5 minutes
  Timer? _countdownTimer;
  bool _loading = false;
  String _errorMsg = '';

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining > 0) {
        setState(() {
          _secondsRemaining--;
        });
      } else {
        _countdownTimer?.cancel();
        _triggerAutoSOS();
      }
    });
  }

  Future<void> _triggerAutoSOS() async {
    setState(() {
      _loading = true;
    });
    try {
      // Trigger SOS on server due to check-in timeout escalation
      await ApiService.triggerSOS(0.0, 0.0, triggerType: 'timeout');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('TIMEOUT EXPIRED: Automatic SOS alert dispatched to guardians!'),
            backgroundColor: Colors.red,
          ),
        );
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const HomeScreen()),
        );
      }
    } catch (e) {
      print('Auto-SOS failed: $e');
    }
  }

  Future<void> _verifyCheckIn(String action) async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _errorMsg = '';
    });

    try {
      final pin = _pinController.text.trim();
      final res = await ApiService.checkIn(pin, action);

      if (mounted) {
        if (res['success'] == true) {
          _countdownTimer?.cancel();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(action == 'complete' ? 'Trip finished safely!' : 'Trip extended by 15 minutes.'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const HomeScreen()),
          );
        } else {
          setState(() {
            _errorMsg = res['message'] ?? 'Incorrect MPIN code.';
          });
        }
      }
    } catch (e) {
      setState(() {
        _errorMsg = 'Check-in failed: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _pinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Color(0xFF080B11);
    const cardColor = Color(0xFF0F172A);
    const dangerColor = Color(0xFFEF4444);

    final minutes = (_secondsRemaining / 60).floor().toString().padLeft(2, '0');
    final seconds = (_secondsRemaining % 60).toString().padLeft(2, '0');

    return WillPopScope(
      onWillPop: () async => false, // Lock back button to enforce safety response
      child: Scaffold(
        backgroundColor: bgColor,
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.security_update_warning_outlined,
                    size: 80,
                    color: dangerColor,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Safety Check-In Required',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: 'Outfit',
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'You have crossed your travel destination timeline. Please verify your safety or extend the trip.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                  const SizedBox(height: 32),

                  // Timer Dial
                  Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: dangerColor.withOpacity(0.3), width: 6),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '$minutes:$seconds',
                      style: const TextStyle(
                        color: dangerColor,
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  if (_errorMsg.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        border: Border.all(color: Colors.red.withOpacity(0.3)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _errorMsg,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Form Panel
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: cardColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.05)),
                    ),
                    child: Column(
                      children: [
                        const Text(
                          'ENTER 4-DIGIT MPIN',
                          style: TextStyle(
                            color: Colors.grey,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _pinController,
                          obscureText: true,
                          keyboardType: TextInputType.number,
                          maxLength: 4,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            letterSpacing: 16,
                            fontFamily: 'monospace',
                          ),
                          decoration: const InputDecoration(
                            counterText: '',
                            hintText: '••••',
                            hintStyle: TextStyle(color: Colors.grey, letterSpacing: 16),
                            border: UnderlineInputBorder(
                              borderSide: BorderSide(color: Colors.grey),
                            ),
                          ),
                          validator: (val) {
                            if (val!.length != 4 || int.tryParse(val) == null) {
                              return 'Enter your 4-digit code';
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  if (_loading)
                    const CircularProgressIndicator(color: dangerColor)
                  else ...[
                    // Action Buttons Row
                    Row(
                      children: [
                        // Extend Button
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _verifyCheckIn('extend'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              side: const BorderSide(color: Colors.blueAccent),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Extend 15m',
                              style: TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        // Complete Button
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => _verifyCheckIn('complete'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              backgroundColor: Colors.green,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Safe Arrival',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ]
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
