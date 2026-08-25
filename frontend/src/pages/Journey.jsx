import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { CheckCircle2, LocateFixed, MapPin, Route, Search, ShieldAlert, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const DEFAULT = [13.2172, 79.1003];
const pin = L.divIcon({
  className: 'map-icon',
  html: '<div class="map-dot destination"></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});
const currentPin = L.divIcon({
  className: 'map-icon',
  html: '<div class="map-dot current"></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const geocodeCache = new Map();

function ClickPicker({ onPick }) {
  useMapEvents({
    click: (event) => onPick([event.latlng.lat, event.latlng.lng]),
  });
  return null;
}

function Fly({ center }) {
  const map = useMap();
  const lastCenter = useRef(null);

  useEffect(() => {
    if (!center || !Number.isFinite(center[0])) return;
    const key = `${center[0].toFixed(4)}_${center[1].toFixed(4)}`;
    if (lastCenter.current === key) return;
    lastCenter.current = key;
    map.flyTo(center, 16, { duration: 0.6 });
  }, [center, map]);

  return null;
}

async function geocode(query, signal) {
  const normalized = query.trim().toLowerCase();
  if (geocodeCache.has(normalized)) {
    return geocodeCache.get(normalized);
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=7&addressdetails=1&q=${encodeURIComponent(
    query
  )}`;

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SafeCalc/1.0',
    },
  });

  if (!response.ok) throw new Error('Location search failed.');
  const data = await response.json();
  const results = data
    .map((item) => ({
      name: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

  geocodeCache.set(normalized, results);
  return results;
}

export default function Journey() {
  const { apiRequest } = useAuth();
  const [pos, setPos] = useState(DEFAULT);
  const [dest, setDest] = useState(DEFAULT);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('Ola');
  const [vehicle, setVehicle] = useState('');
  const [duration, setDuration] = useState(30);
  const [radius, setRadius] = useState(200);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [isExactSelected, setIsExactSelected] = useState(false);

  const [activeJourney, setActiveJourney] = useState(null);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [mpinInput, setMpinInput] = useState('');
  const [ending, setEnding] = useState(false);
  const [sosTriggering, setSosTriggering] = useState(false);

  const timer = useRef(null);
  const abortControllerRef = useRef(null);

  const syncActiveJourney = useCallback(async () => {
    try {
      const res = await apiRequest('/api/journey/active');
      if (res?.success && res.data) {
        setActiveJourney(res.data);
        if (res.data.destinationLatitude && res.data.destinationLongitude) {
          setDest([res.data.destinationLatitude, res.data.destinationLongitude]);
          setName(res.data.destinationName || '');
        }
      } else {
        setActiveJourney(null);
      }
    } catch (err) {
      console.error('Active journey check error:', err);
    }
  }, [apiRequest]);

  useEffect(() => {
    syncActiveJourney();
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const userPos = [p.coords.latitude, p.coords.longitude];
        setPos(userPos);
        setDest(userPos);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => {
      window.clearTimeout(timer.current);
      abortControllerRef.current?.abort();
    };
  }, [syncActiveJourney]);

  const search = useCallback((value) => {
    setQuery(value);
    setName(value);
    setIsExactSelected(false);
    setMessage('');
    window.clearTimeout(timer.current);
    abortControllerRef.current?.abort();

    if (!value.trim() || value.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    timer.current = window.setTimeout(async () => {
      setSearching(true);
      abortControllerRef.current = new AbortController();
      try {
        const results = await geocode(value.trim(), abortControllerRef.current.signal);
        setSuggestions(results);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setSearching(false);
      }
    }, 450);
  }, []);

  const select = (suggestion) => {
    setName(suggestion.name);
    setQuery(suggestion.name);
    setDest([suggestion.lat, suggestion.lng]);
    setSuggestions([]);
    setIsExactSelected(true);
    setMessage('Exact destination selected on the map.');
  };

  const chooseCurrent = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setMessage('Current location updated.');
      },
      () => setMessage('Location permission denied.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const start = async (event) => {
    event.preventDefault();
    setMessage('');

    let destination = dest;
    let destinationName = (name || query).trim();

    if (!destinationName) {
      setMessage('Please enter a destination or pick a location on the map.');
      return;
    }

    if (!isExactSelected) {
      setLoading(true);
      try {
        const results = await geocode(destinationName);
        if (!results.length) {
          setMessage('The destination could not be found. Please select from search suggestions or tap the map.');
          return;
        }
        destination = [results[0].lat, results[0].lng];
        destinationName = results[0].name;
        setDest(destination);
        setName(destinationName);
        setQuery(destinationName);
        setIsExactSelected(true);
      } catch (error) {
        setMessage(error.message || 'Unable to locate the destination.');
        return;
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    try {
      const location = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 3000,
        });
      });

      const expected = new Date(Date.now() + duration * 60000).toISOString();
      const result = await apiRequest('/api/journey/start', {
        method: 'POST',
        body: JSON.stringify({
          destinationName,
          destinationLatitude: destination[0],
          destinationLongitude: destination[1],
          destinationRadius: radius,
          travelMode: mode,
          vehicleNumber: vehicle.trim(),
          expectedReachTime: expected,
          currentLatitude: location.coords.latitude,
          currentLongitude: location.coords.longitude,
        }),
      });

      if (!result.success) throw new Error(result.message || 'Unable to start journey.');
      setMessage('Journey started successfully. Your current location is being tracked.');
      setActiveJourney(result.data);
    } catch (error) {
      setMessage(
        error.code === 1
          ? 'Location permission is required to start a monitored journey.'
          : error.message || 'Unable to start journey.'
      );
    } finally {
      setLoading(false);
    }
  };

  const submitEndJourney = async (e) => {
    if (e) e.preventDefault();
    if (!/^\d{4}$/.test(mpinInput.trim())) {
      setMessage('Please enter your 4-digit Safety MPIN.');
      return;
    }
    setEnding(true);
    setMessage('');
    try {
      const res = await apiRequest('/api/journey/end', {
        method: 'POST',
        body: JSON.stringify({ mpin: mpinInput.trim() }),
      });
      if (res?.success) {
        setActiveJourney(null);
        setEndModalOpen(false);
        setMpinInput('');
        setMessage('✅ Travel ended safely. Your journey tracking has stopped.');
      } else {
        setMessage(res?.message || 'Incorrect MPIN or unable to end travel.');
      }
    } catch (err) {
      console.error(err);
      setMessage('Unable to end travel.');
    } finally {
      setEnding(false);
    }
  };

  const handleTriggerSos = async () => {
    setSosTriggering(true);
    setMessage('');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      const res = await apiRequest('/api/alerts/trigger', {
        method: 'POST',
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          triggerType: 'manual_sos',
        }),
      });
      if (res?.success) {
        setMessage('🚨 SOS Emergency triggered! Emergency contacts have been notified.');
      } else {
        setMessage(res?.message || 'Unable to trigger SOS.');
      }
    } catch (err) {
      console.error(err);
      setMessage('Unable to send SOS.');
    } finally {
      setSosTriggering(false);
    }
  };

  return (
    <Layout title="Journey">
      <div className="page-header">
        <div>
          <span className="eyebrow">TRAVEL SAFETY</span>
          <h1>Plan a monitored journey</h1>
          <p>Search an exact destination, select it, and then start your monitored trip.</p>
        </div>
      </div>

      <div className="journey-layout">
        {activeJourney ? (
          <div className="panel journey-form">
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Route size={20} style={{ color: '#3b82f6' }} />
                <h2>Active Monitored Journey</h2>
              </div>
              <span className="status-chip active" style={{ fontSize: '11px', textTransform: 'uppercase', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                {String(activeJourney.status || 'Active').replaceAll('_', ' ')}
              </span>
            </div>

            {message && (
              <div className={message.includes('successfully') || message.includes('safely') ? 'form-success' : 'form-error'}>
                {message}
              </div>
            )}

            <div style={{ padding: '16px', background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)', margin: '12px 0' }}>
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Destination</span>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', margin: '4px 0 0' }}>{activeJourney.destinationName}</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: '#cbd5e1' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Travel Mode</span>
                  <strong>{activeJourney.travelMode || 'N/A'}</strong>
                  {activeJourney.vehicleNumber && <span> ({activeJourney.vehicleNumber})</span>}
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Expected Arrival</span>
                  <strong>
                    {activeJourney.expectedReachTime
                      ? new Date(activeJourney.expectedReachTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <button
                type="button"
                className="btn success full"
                style={{ minHeight: '44px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  setMpinInput('');
                  setEndModalOpen(true);
                }}
              >
                <CheckCircle2 size={18} />
                End Journey
              </button>

              <button
                type="button"
                className="btn danger full"
                style={{ minHeight: '44px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                disabled={sosTriggering}
                onClick={handleTriggerSos}
              >
                <ShieldAlert size={18} />
                {sosTriggering ? 'Sending SOS…' : 'TRIGGER SOS'}
              </button>
            </div>
          </div>
        ) : (
          <form className="panel journey-form" onSubmit={start}>
            <div className="panel-title">
              <Route size={18} />
              <h2>Journey details</h2>
            </div>
            {message && (
              <div
                className={
                  message.includes('successfully') || message.includes('selected')
                    ? 'form-success'
                    : 'form-error'
                }
              >
                {message}
              </div>
            )}

            <label>
              Destination search
              <div className="search-field">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(e) => search(e.target.value)}
                  placeholder="Search exact place, address or landmark…"
                  autoComplete="off"
                />
              </div>
            </label>

            {searching && <div className="search-status">Searching exact locations…</div>}

            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={`${suggestion.lat}-${suggestion.lng}`}
                    onClick={() => select(suggestion)}
                  >
                    <MapPin size={15} />
                    <span>{suggestion.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="preset-row">
              {['Saveetha Engineering College', 'Chittoor Railway Station', 'Tirupati Airport'].map(
                (item) => (
                  <button type="button" key={item} onClick={() => search(item)}>
                    {item}
                  </button>
                )
              )}
            </div>

            <div className="form-grid">
              <label>
                Travel mode
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option>Ola</option>
                  <option>Uber</option>
                  <option>Rapido</option>
                  <option>Own Vehicle</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Vehicle number
                <input
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                Duration (minutes)
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label>
                Destination safe radius
                <div className="range-label">
                  <b>{radius}m</b>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1500"
                  step="50"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
              </label>
            </div>

            <button
              type="button"
              className="btn outline blue full"
              onClick={chooseCurrent}
            >
              <LocateFixed size={16} /> Use current location
            </button>
            <button className="btn primary full" disabled={loading}>
              {loading ? (
                'Locating / starting…'
              ) : (
                <>
                  <CheckCircle2 size={16} /> Start Journey
                </>
              )}
            </button>
          </form>
        )}

        <div className="panel map-panel">
          <div className="map-toolbar">
            <div>
              <strong>Destination map</strong>
              <span>{name || 'Select a search result or click the map'}</span>
            </div>
            <span className="map-coords">
              {dest[0].toFixed(5)}, {dest[1].toFixed(5)}
            </span>
          </div>
          <div className="journey-map">
            <MapContainer
              center={dest}
              zoom={14}
              scrollWheelZoom
              className="dashboard-map"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Fly center={dest} />
              <ClickPicker
                onPick={(point) => {
                  setDest(point);
                  setName(`Selected location (${point[0].toFixed(5)}, ${point[1].toFixed(5)})`);
                  setQuery(`Selected location (${point[0].toFixed(5)}, ${point[1].toFixed(5)})`);
                  setSuggestions([]);
                }}
              />
              <Marker position={dest} icon={pin} />
              <Circle
                center={dest}
                radius={radius}
                pathOptions={{
                  color: '#ec4899',
                  fillColor: '#ec4899',
                  fillOpacity: 0.1,
                }}
              />
              <Marker position={pos} icon={currentPin} />
            </MapContainer>
          </div>
          <div className="map-help">
            <MapPin size={14} /> Pink marker = exact destination · Blue marker = your current location
          </div>
        </div>
      </div>

      {/* END JOURNEY MPIN VERIFICATION MODAL */}
      {endModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <button
              className="modal-x"
              onClick={() => {
                if (ending) return;
                setEndModalOpen(false);
                setMpinInput('');
              }}
            >
              ×
            </button>

            <div className="modal-icon green" style={{ margin: '0 auto 12px' }}>
              <CheckCircle2 size={24} />
            </div>

            <h2 style={{ fontSize: '18px', margin: '0 0 6px' }}>Verify MPIN to End Journey</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px' }}>
              Enter your 4-digit Safety MPIN to confirm that you have reached safely and finish journey tracking.
            </p>

            <form onSubmit={submitEndJourney} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                value={mpinInput}
                onChange={(e) => setMpinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                autoFocus
                className="mpin-field"
                style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '24px', fontWeight: 'bold', padding: '12px', width: '100%' }}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn outline blue full"
                  disabled={ending}
                  onClick={() => {
                    setEndModalOpen(false);
                    setMpinInput('');
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn success full"
                  disabled={ending || mpinInput.length !== 4}
                >
                  {ending ? 'Verifying…' : 'Verify & End'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
