import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, MapPin, Plus, Trash2, Search, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const DEFAULT = [13.2172, 79.1003];

const currentMarker = L.divIcon({
  className: 'map-icon',
  html: '<div class="map-dot safe"></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const savedMarker = L.divIcon({
  className: 'map-icon',
  html: '<div class="map-dot destination"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function ClickPicker({ onPick }) {
  useMapEvents({ click: (event) => onPick([event.latlng.lat, event.latlng.lng]) });
  return null;
}

function Fly({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center[0])) {
      map.flyTo(center, 15, { duration: 0.5 });
    }
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

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const load = async () => {
    try {
      const result = await apiRequest('/api/safeplaces');
      if (result?.success) setPlaces(result.data || []);
    } catch (e) {
      console.error('Load safe places error:', e);
    }
  };

  useEffect(() => {
    load();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords([p.coords.latitude, p.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const handleSearch = (val) => {
    setQuery(val);
    if (!name) setName(val);
    clearTimeout(searchTimer.current);
    if (!val.trim() || val.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(val.trim())}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'SafeCalc/1.0' } });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(
            data.map((item) => ({
              name: item.display_name,
              lat: Number(item.lat),
              lng: Number(item.lon),
            }))
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const selectSuggestion = (sugg) => {
    setCoords([sugg.lat, sugg.lng]);
    const shortName = sugg.name.split(',')[0] || sugg.name;
    setName(shortName);
    setQuery(shortName);
    setSuggestions([]);
    setMessage(`Location selected: ${shortName}`);
  };

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
      if (!result?.success) throw new Error(result?.message || 'Unable to save safe place.');
      setName('');
      setQuery('');
      setRadius(200);
      setMessage('✅ Safe zone saved successfully.');
      await load();
    } catch (e) {
      setError(e.message || 'Unable to save safe place.');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    const result = await apiRequest(`/api/safeplaces/${id}`, { method: 'DELETE' });
    if (result?.success) {
      setPlaces((current) => current.filter((place) => String(place._id) !== String(id)));
      setMessage('Safe zone deleted.');
    } else {
      setError(result?.message || 'Unable to delete safe zone.');
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
        setMessage('Map centered on your current location.');
      },
      () => setError('Location permission denied.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );
  };

  return (
    <Layout title="Safety Map">
      <div className="page-header">
        <div>
          <span className="eyebrow">LIVE LOCATION & GEOFENCING</span>
          <h1>Safety Map & Safe Zones</h1>
          <p>Search any location, tap the map, or use your live GPS to establish trusted safe zones.</p>
        </div>

        <button className="btn outline blue" onClick={locate}>
          <RefreshCw size={16} /> Locate Me
        </button>
      </div>

      <div className="geo-layout">
        <div>
          <div className="panel geo-form">
            <div className="panel-title">
              <MapPin size={18} />
              <h2>Add Safe Place</h2>
            </div>
            {error && <div className="form-error">{error}</div>}
            {message && <div className="form-success">{message}</div>}

            <label>
              Search Location
              <div className="search-field">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search address, landmark or city…"
                  autoComplete="off"
                />
              </div>
            </label>

            {searching && <div className="search-status">Searching locations…</div>}

            {suggestions.length > 0 && (
              <div className="suggestions" style={{ marginBottom: '12px' }}>
                {suggestions.map((s) => (
                  <button type="button" key={`${s.lat}-${s.lng}`} onClick={() => selectSuggestion(s)}>
                    <MapPin size={14} />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            )}

            <label>
              Place Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Home / College / Office / Gym"
              />
            </label>

            <div className="coords-grid">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  value={coords[0]}
                  onChange={(e) => setCoords([Number(e.target.value), coords[1]])}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  value={coords[1]}
                  onChange={(e) => setCoords([coords[0], Number(e.target.value)])}
                />
              </label>
            </div>

            <button className="btn outline blue full" onClick={locate}>
              <Crosshair size={16} /> Use current location
            </button>

            <label>
              Safe Radius <strong className="range-value">{radius}m</strong>
              <input
                type="range"
                min="50"
                max="1500"
                step="50"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
            </label>

            <button className="btn success full" disabled={loading} onClick={save}>
              <Plus size={16} />
              {loading ? 'Saving…' : 'Save Safe Place'}
            </button>
          </div>

          <div className="panel" style={{ marginTop: '16px' }}>
            <div className="panel-title">
              <ShieldCheck size={18} style={{ color: '#10b981' }} />
              <h2>Saved Safe Places ({places.length})</h2>
            </div>
            {places.length === 0 ? (
              <div className="empty-small">No safe places created yet. Search or click the map to add one.</div>
            ) : (
              <div className="place-list">
                {places.map((place) => (
                  <div
                    className="place-row"
                    key={place._id}
                    onClick={() => {
                      setCoords([place.latitude, place.longitude]);
                      setName(place.name);
                      setRadius(place.radius || 200);
                      setMessage(`Selected: ${place.name}`);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="place-icon green">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <strong>{place.name}</strong>
                      <span>
                        {Number(place.latitude).toFixed(4)}, {Number(place.longitude).toFixed(4)} · {place.radius}m radius
                      </span>
                    </div>
                    <button
                      className="icon-danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(place._id);
                      }}
                      aria-label={`Delete ${place.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel map-panel geofence-map-panel">
          <div className="map-toolbar">
            <div>
              <strong>Safe Zone Map</strong>
              <span>Click any spot to define a safe perimeter</span>
            </div>
            <span className="map-coords">
              {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
            </span>
          </div>
          <div className="geofence-map-canvas" style={{ minHeight: '500px', height: '100%' }}>
            <MapContainer center={coords} zoom={14} scrollWheelZoom className="dashboard-map">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Fly center={coords} />
              <ClickPicker
                onPick={(point) => {
                  setCoords(point);
                  setError('');
                  setMessage('Location selected on map.');
                }}
              />
              <Marker position={coords} icon={currentMarker}>
                <Popup>Selected Target Point</Popup>
              </Marker>
              <Circle
                center={coords}
                radius={radius}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15 }}
              />

              {places.map((place) => (
                <React.Fragment key={place._id}>
                  <Marker position={[place.latitude, place.longitude]} icon={savedMarker}>
                    <Popup>
                      <strong>{place.name}</strong>
                      <br />
                      Safe Radius: {place.radius}m
                    </Popup>
                  </Marker>
                  <Circle
                    center={[place.latitude, place.longitude]}
                    radius={place.radius}
                    pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.12 }}
                  />
                </React.Fragment>
              ))}
            </MapContainer>
          </div>
          <div className="map-help">
            <MapPin size={14} /> Blue pin/circle = target zone · Green pins/circles = saved safe places
          </div>
        </div>
      </div>
    </Layout>
  );
}
