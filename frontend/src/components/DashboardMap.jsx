import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

const DEFAULT_CENTER = [13.2172, 79.1003];

const sosIcon = L.divIcon({
  className: 'map-icon',
  html: '<div class="map-dot sos">SOS</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const currentIcon = L.divIcon({
  className: 'map-icon',
  html: '<div class="map-dot current"></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destinationIcon = L.divIcon({
  className: 'map-icon',
  html: '<div class="map-dot destination"></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const safeIcon = L.divIcon({
  className: 'map-icon',
  html: '<div class="map-dot safe"></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function Recenter({ targetLat, targetLng, zoom }) {
  const map = useMap();
  const lastFlown = useRef(null);

  useEffect(() => {
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return;

    const key = `${targetLat.toFixed(4)}_${targetLng.toFixed(4)}_${zoom}`;
    if (lastFlown.current === key) return;

    lastFlown.current = key;
    map.flyTo([targetLat, targetLng], zoom, { duration: 0.5 });
  }, [targetLat, targetLng, zoom, map]);

  return null;
}

function DashboardMapComponent({
  activeAlerts = [],
  activeJourneys = [],
  safePlaces = [],
  selectedLocation = null,
}) {
  const firstAlert = activeAlerts[0];
  const firstJourney = activeJourneys[0];

  const target = useMemo(() => {
    if (selectedLocation && Number.isFinite(Number(selectedLocation.lat))) {
      return {
        lat: Number(selectedLocation.lat),
        lng: Number(selectedLocation.lng),
        zoom: 16,
      };
    }
    if (firstAlert && Number.isFinite(Number(firstAlert.latitude))) {
      return {
        lat: Number(firstAlert.latitude),
        lng: Number(firstAlert.longitude),
        zoom: 15,
      };
    }
    if (firstJourney) {
      const lat = Number(firstJourney.currentLatitude ?? firstJourney.destinationLatitude);
      const lng = Number(firstJourney.currentLongitude ?? firstJourney.destinationLongitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, zoom: 14 };
      }
    }
    return {
      lat: DEFAULT_CENTER[0],
      lng: DEFAULT_CENTER[1],
      zoom: 12,
    };
  }, [
    selectedLocation?.lat,
    selectedLocation?.lng,
    firstAlert?.latitude,
    firstAlert?.longitude,
    firstJourney?.currentLatitude,
    firstJourney?.currentLongitude,
    firstJourney?.destinationLatitude,
    firstJourney?.destinationLongitude,
  ]);

  return (
    <div className="map-card">
      <MapContainer
        center={[target.lat, target.lng]}
        zoom={target.zoom}
        scrollWheelZoom
        className="dashboard-map"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter
          targetLat={target.lat}
          targetLng={target.lng}
          zoom={target.zoom}
        />

        {/* Active Emergency SOS Alerts */}
        {activeAlerts.map((alert) => {
          if (!Number.isFinite(Number(alert.latitude))) return null;
          return (
            <React.Fragment key={alert._id || alert.alertId}>
              <Marker
                position={[alert.latitude, alert.longitude]}
                icon={sosIcon}
              >
                <Popup>
                  <strong>🚨 SOS ALERT</strong>
                  <br />
                  {alert.user?.name || 'User in Danger'}
                  {alert.user?.phone ? <><br /><a href={`tel:${alert.user.phone}`}>{alert.user.phone}</a></> : ''}
                </Popup>
              </Marker>
              <Circle
                center={[alert.latitude, alert.longitude]}
                radius={150}
                pathOptions={{
                  color: '#ff5252',
                  fillColor: '#ff5252',
                  fillOpacity: 0.15,
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Active Journeys */}
        {activeJourneys.map((j) => {
          const currentLat = Number(j.currentLatitude ?? j.destinationLatitude);
          const currentLng = Number(j.currentLongitude ?? j.destinationLongitude);
          const destLat = Number(j.destinationLatitude);
          const destLng = Number(j.destinationLongitude);

          return (
            <React.Fragment key={j._id || j.journeyId}>
              {Number.isFinite(currentLat) && Number.isFinite(currentLng) && (
                <Marker position={[currentLat, currentLng]} icon={currentIcon}>
                  <Popup>
                    Current location
                    <br />
                    {j.destinationName}
                  </Popup>
                </Marker>
              )}
              {Number.isFinite(destLat) && Number.isFinite(destLng) && (
                <>
                  <Marker position={[destLat, destLng]} icon={destinationIcon}>
                    <Popup>
                      Destination
                      <br />
                      {j.destinationName}
                    </Popup>
                  </Marker>
                  <Circle
                    center={[destLat, destLng]}
                    radius={Number(j.destinationRadius) || 200}
                    pathOptions={{
                      color: '#ec4899',
                      fillColor: '#ec4899',
                      fillOpacity: 0.08,
                    }}
                  />
                </>
              )}
            </React.Fragment>
          );
        })}

        {/* Safe Places */}
        {safePlaces.map((p) => {
          if (!Number.isFinite(Number(p.latitude))) return null;
          return (
            <React.Fragment key={p._id}>
              <Marker position={[p.latitude, p.longitude]} icon={safeIcon}>
                <Popup>{p.name}</Popup>
              </Marker>
              <Circle
                center={[p.latitude, p.longitude]}
                radius={Number(p.radius) || 200}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.06,
                }}
              />
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default React.memo(DashboardMapComponent);
