package com.travelsafetysos.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.util.Log

class MainActivity : FlutterActivity() {
    private val TRACKING_CHANNEL = "com.travelsafetysos.mobile/tracking"
    private var methodChannel: MethodChannel? = null
    
    private var locationReceiver: BroadcastReceiver? = null
    private var breachReceiver: BroadcastReceiver? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, TRACKING_CHANNEL)
        methodChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "startTracking" -> {
                    val destLat = call.argument<Double>("destLat") ?: 0.0
                    val destLng = call.argument<Double>("destLng") ?: 0.0
                    val destRadius = call.argument<Double>("destRadius")?.toFloat() ?: 200.0f
                    
                    startTrackingService(destLat, destLng, destRadius)
                    result.success(true)
                }
                "stopTracking" -> {
                    stopTrackingService()
                    result.success(true)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }

        registerReceivers()
    }

    private fun startTrackingService(destLat: Double, destLng: Double, destRadius: Float) {
        Log.d("MainActivity", "Starting LocationService: Lat=$destLat, Lng=$destLng, Rad=$destRadius")
        val serviceIntent = Intent(this, LocationService::class.java).apply {
            putExtra("destLat", destLat)
            putExtra("destLng", destLng)
            putExtra("destRadius", destRadius)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }

    private fun stopTrackingService() {
        Log.d("MainActivity", "Stopping LocationService")
        val serviceIntent = Intent(this, LocationService::class.java)
        stopService(serviceIntent)
    }

    private fun registerReceivers() {
        // Receiver for active coordinates changes
        locationReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                intent?.let {
                    val lat = it.getDoubleExtra("lat", 0.0)
                    val lng = it.getDoubleExtra("lng", 0.0)
                    val distance = it.getDoubleExtra("distance", 0.0)
                    
                    // Push coordinates change back to Dart
                    methodChannel?.invokeMethod("onLocationUpdate", mapOf(
                        "lat" to lat,
                        "lng" to lng,
                        "distance" to distance
                    ))
                }
            }
        }

        // Receiver for geofence breaches
        breachReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                intent?.let {
                    val lat = it.getDoubleExtra("lat", 0.0)
                    val lng = it.getDoubleExtra("lng", 0.0)
                    
                    // Push geofence violation event back to Dart
                    methodChannel?.invokeMethod("onGeofenceBreach", mapOf(
                        "lat" to lat,
                        "lng" to lng
                    ))
                }
            }
        }

        // Register receivers in activity filter context
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(locationReceiver, IntentFilter("COM_TRAVELSAFETYSOS_LOCATION_UPDATE"), RECEIVER_EXPORTED)
            registerReceiver(breachReceiver, IntentFilter("COM_TRAVELSAFETYSOS_GEOFENCE_BREACH_ALERT"), RECEIVER_EXPORTED)
        } else {
            registerReceiver(locationReceiver, IntentFilter("COM_TRAVELSAFETYSOS_LOCATION_UPDATE"))
            registerReceiver(breachReceiver, IntentFilter("COM_TRAVELSAFETYSOS_GEOFENCE_BREACH_ALERT"))
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        locationReceiver?.let { unregisterReceiver(it) }
        breachReceiver?.let { unregisterReceiver(it) }
    }
}
