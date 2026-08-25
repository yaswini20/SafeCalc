import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/onboarding_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/api_service.dart';
import 'services/push_notification_service.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize APIs and load saved tokens
  await ApiService.init();

  // Check onboarding status
  final prefs = await SharedPreferences.getInstance();
  final bool onboarded = prefs.getBool('onboarded') ?? false;

  // Do not block the first screen on Firebase/FCM initialization.
  // Notifications are initialized after the first frame in the background.
  runApp(MyApp(onboarded: onboarded));

  WidgetsBinding.instance.addPostFrameCallback((_) async {
    try {
      await Firebase.initializeApp();
      await PushNotificationService.initialize();
    } catch (e) {
      print('Firebase/push initialization failed: $e');
    }
  });
}

class MyApp extends StatelessWidget {
  final bool onboarded;
  const MyApp({super.key, required this.onboarded});

  @override
  Widget build(BuildContext context) {
    // Determine initial route based on authorization state
    final bool isLoggedIn = ApiService.isAuthenticated;

    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Safe Calc',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFFFF6D6D),
        scaffoldBackgroundColor: const Color(0xFF121212),
        fontFamily: 'sans-serif',
        
        // Input decoration theme styling
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.transparent,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.white.withOpacity(0.12)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: Colors.white.withOpacity(0.12)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFFF6D6D), width: 1.5),
          ),
          labelStyle: const TextStyle(color: Colors.grey, fontSize: 14),
        ),
      ),
      home: isLoggedIn 
          ? const HomeScreen() 
          : (onboarded ? const LoginScreen() : const OnboardingScreen()),
    );
  }
}

