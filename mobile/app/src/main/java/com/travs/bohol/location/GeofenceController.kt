package com.travs.bohol.location

import android.content.Context
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.LocationServices

class GeofenceController(context: Context) {
    private val client: GeofencingClient = LocationServices.getGeofencingClient(context)

    fun buildDestinationGeofence(
        destinationId: Long,
        latitude: Double,
        longitude: Double,
        radiusMeters: Float = 300f
    ): Geofence =
        Geofence.Builder()
            .setRequestId("destination:$destinationId")
            .setCircularRegion(latitude, longitude, radiusMeters)
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
            .build()

    fun client(): GeofencingClient = client
}
