import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, MapPin, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const DEFAULT = [13.2172, 79.1003];
const marker = L.divIcon({ className: 'map-icon', html: '<div class="map-dot safe"></div>', iconSize: [34, 34], iconAnchor: [17, 17] });

function ClickPicker({ onPick }) {
  useMapEvents({ click: (event) => onPick([event.latlng.lat, event.latlng.lng]) });
  return null;
}

function Fly({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 16, { duration: 0.5 });
  }, [center, map]);
  return null;
}

export default function Geofences() {
  const { apiRequest } = useAuth();
  const [places, setPlaces] = useState([]);
  const [name, setName] = useState('');
  const [coords, setCoords] = useState(DEFAULT);
  const [radius, setRadius] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const result = await apiRequest('/api/safeplaces');
    if (result.success) setPlaces(result.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setError('');
    setMessage('');
    if (!name.trim()) {
      setError('Enter a safe place name.');
      return;
    }
    if (!Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) {
      setError('Choose a valid location on the map.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest('/api/safeplaces', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          latitude: Number(coords[0]),
          longitude: Number(coords[1]),
          radius: Number(radius),
        }),
      });
      if (!result.success) throw new Error(result.message || 'Unable to save safe place.');
      setName('');
      setRadius(200);
      setMessage('Safe zone saved successfully.');
      await load();
    } catch (e) {
      setError(e.message || 'Unable to save safe place.');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    const result = await apiRequest(`/api/safeplaces/${id}`, { method: 'DELETE' });
    if (result.success) {
      setPlaces((current) => current.filter((place) => String(place._id) !== String(id)));
      setMessage('Safe zone deleted.');
    } else {
      setError(result.message || 'Unable to delete safe zone.');
    }
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setError('Browser location is not available.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords([p.coords.latitude, p.coords.longitude]);
        setError('');
        setMessage('Current location selected.');
      },
      () => setError('Location permission denied.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 },
    );
  };

  return (
    <Layout title="Safety Map">
      <div className="page-header">
        <div>
          <span className="eyebrow">LIVE LOCATION</span>
          <h1>Safety Map & Safe Zones</h1>
          <p>Click anywhere on the map, choose your current location, or enter coordinates to create a trusted zone.</p>
        </div>
      </div>

      <div className="geo-layout">
        <div>
          <div className="panel geo-form">
            <div className="panel-title"><MapPin size={18}/><h2>Add safe place</h2></div>
            {error && <div className="form-error">{error}</div>}
            {message && <div className="form-success">{message}</div>}

            <label>Place name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Home / College / Office"/></label>

            <div className="coords-grid">
              <label>Latitude<input type="number" step="any" value={coords[0]} onChange={(e) => setCoords([Number(e.target.value), coords[1]])}/></label>
              <label>Longitude<input type="number" step="any" value={coords[1]} onChange={(e) => setCoords([coords[0], Number(e.target.value)])}/></label>
            </div>

            <button className="btn outline blue full" onClick={locate}><Crosshair size={16}/> Use current location</button>

            <label>
              Safe radius <strong className="range-value">{radius}m</strong>
              <input type="range" min="50" max="1500" step="50" value={radius} onChange={(e) => setRadius(Number(e.target.value))}/>
            </label>

            <button className="btn success full" disabled={loading} onClick={save}><Plus size={16}/>{loading ? 'Saving…' : 'Save safe place'}</button>
          </div>

          <div className="panel">
            <div className="panel-title"><h2>Saved safe places</h2></div>
            {places.length === 0 ? (
              <div className="empty-small">No safe places yet. Select a location on the map and save it.</div>
            ) : (
              <div className="place-list">
                {places.map((place) => (
                  <div className="place-row" key={place._id} onClick={() => setCoords([place.latitude, place.longitude])}>
                    <div className="place-icon green"><MapPin size={16}/></div>
                    <div><strong>{place.name}</strong><span>{Number(place.latitude).toFixed(5)}, {Number(place.longitude).toFixed(5)} · {place.radius}m</span></div>
                    <button className="icon-danger" onClick={(event) => { event.stopPropagation(); remove(place._id); }} aria-label={`Delete ${place.name}`}><Trash2 size={15}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel map-panel geofence-map-panel">
          <div className="map-toolbar">
            <div><strong>Safe zone map</strong><span>Click the map to select a point</span></div>
            <span className="map-coords">{coords[0].toFixed(5)}, {coords[1].toFixed(5)}</span>
          </div>
          <div className="geofence-map-canvas">
            <MapContainer center={coords} zoom={14} scrollWheelZoom className="dashboard-map">
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
              <Fly center={coords}/>
              <ClickPicker onPick={(point) => { setCoords(point); setError(''); setMessage('Map location selected.'); }}/>
              <Marker position={coords} icon={marker}/>
              <Circle center={coords} radius={radius} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}/>
              {places.map((place) => (
                <Circle key={place._id} center={[place.latitude, place.longitude]} radius={place.radius} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.08 }}/>
              ))}
            </MapContainer>
          </div>
          <div className="map-help"><MapPin size={14}/> Blue circle = new zone · Green circles = saved zones</div>
        </div>
      </div>
    </Layout>
  );
}
