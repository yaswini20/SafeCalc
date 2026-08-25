package com.travelsafetysos.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import android.util.Log

class GeofenceBroadcastReceiver : BroadcastReceiver() {

    companion object {
        private const val CHANNEL_ID = "GeofenceAlertChannel"
        private const val NOTIFICATION_ID = 789
        private const val TAG = "GeofenceReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "Broadcast received with action: $action")

        if ("COM_TRAVELSAFETYSOS_GEOFENCE_EXIT" == action) {
            val lat = intent.getDoubleExtra("lat", 0.0)
            val lng = intent.getDoubleExtra("lng", 0.0)
            Log.d(TAG, "Geofence Exit detected at coordinates: ($lat, $lng)")

            // 1. Show native warning notification
            showBreachNotification(context, "You have exited your safe zone boundary! Emergency mode activated.")

            // 2. Broadcast to MainActivity/Flutter channel to trigger backend SOS escalation
            val broadcastIntent = Intent("COM_TRAVELSAFETYSOS_GEOFENCE_BREACH_ALERT")
            broadcastIntent.putExtra("lat", lat)
            broadcastIntent.putExtra("lng", lng)
            context.sendBroadcast(broadcastIntent)
        }
    }

    private fun showBreachNotification(context: Context, message: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Geofence Boundary Violations",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("⚠️ GEOFENCE VIOLATION WARNING")
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        notificationManager.notify(NOTIFICATION_ID, notification)
    }
}
