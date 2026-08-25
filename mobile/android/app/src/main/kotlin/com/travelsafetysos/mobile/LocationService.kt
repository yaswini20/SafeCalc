package com.travelsafetysos.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.core.app.NotificationCompat
import android.util.Log

class LocationService : Service() {

    private var locationManager: LocationManager? = null
    private var locationListener: LocationListener? = null
    
    private var destLat: Double = 0.0
    private var destLng: Double = 0.0
    private var destRadius: Float = 0.0f
    
    companion object {
        private const val CHANNEL_ID = "TravelSafetySOS_Channel"
        private const val NOTIFICATION_ID = 456
        private const val TAG = "LocationService"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service onStartCommand triggered")

        // Retrieve journey destination parameters
        destLat = intent?.getDoubleExtra("destLat", 0.0) ?: 0.0
        destLng = intent?.getDoubleExtra("destLng", 0.0) ?: 0.0
        destRadius = intent?.getFloatExtra("destRadius", 200.0f) ?: 200.0f

        startForeground(NOTIFICATION_ID, buildNotification("Active safety tracking initialized..."))

        requestLocationUpdates()

        return START_STICKY
    }

    private fun requestLocationUpdates() {
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        
        locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                val results = FloatArray(1)
                // Compute distance to destination
                Location.distanceBetween(
                    location.latitude, location.longitude,
                    destLat, destLng,
                    results
                )
                val distance = results[0]
                
                Log.d(TAG, "Location updated: Lat=${location.latitude}, Lng=${location.longitude}, Distance to Dest=${distance}m")

                // Update notification text
                val text = "Distance to Destination: ${distance.toInt()}m"
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.notify(NOTIFICATION_ID, buildNotification(text))

                // Broadcast location back to running Flutter app (via custom broadcast)
                val locIntent = Intent("COM_TRAVELSAFETYSOS_LOCATION_UPDATE")
                locIntent.putExtra("lat", location.latitude)
                locIntent.putExtra("lng", location.longitude)
                locIntent.putExtra("distance", distance.toDouble())
                sendBroadcast(locIntent)

                // If user leaves the destination geofence radius, trigger geofence breach event
                if (distance > destRadius) {
                    Log.d(TAG, "GEOFENCE BREACH: User is outside destination radius!")
                    val geofenceIntent = Intent(applicationContext, GeofenceBroadcastReceiver::class.java)
                    geofenceIntent.action = "COM_TRAVELSAFETYSOS_GEOFENCE_EXIT"
                    geofenceIntent.putExtra("lat", location.latitude)
                    geofenceIntent.putExtra("lng", location.longitude)
                    sendBroadcast(geofenceIntent)
                }
            }

            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }

        try {
            // Check location provider availability and request updates
            if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    5000L, // 5 seconds
                    5.0f,  // 5 meters
                    locationListener!!
                )
            } else {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    5000L,
                    5.0f,
                    locationListener!!
                )
            }
        } catch (ex: SecurityException) {
            Log.e(TAG, "Location permissions denied, service failed to register listener", ex)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        locationListener?.let {
            locationManager?.removeUpdates(it)
        }
        Log.d(TAG, "LocationService Stopped")
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun buildNotification(text: String): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("TravelSafetySOS Active Tracking")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Travel Safety Tracking Channel",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }
}
