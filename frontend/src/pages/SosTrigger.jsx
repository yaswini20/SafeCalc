import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ShieldAlert, Crosshair, ArrowLeft, ShieldCheck, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const SosTrigger = () => {
  const { user, apiRequest } = useAuth();
  const { socket } = useSocket();
  const [sosActive, setSosActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState({ lat: 13.2172, lng: 79.1003 }); // Default Chittoor
  const [gpsStatus, setGpsStatus] = useState('Default Coordinates');
  const [guardians, setGuardians] = useState([]);
  const [responders, setResponders] = useState([]);

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [mpinInput, setMpinInput] = useState('');
  const [activeAlertId, setActiveAlertId] = useState('');

  // Fetch guardians list and check current active alert
  const syncStatus = async () => {
    try {
      // Load emergency contacts
      const contactsRes = await apiRequest('/api/contacts');
      if (contactsRes.success) {
        setGuardians(contactsRes.data);
      }

      // Check if user already has active alerts
      const activeRes = await apiRequest('/api/alerts/active');
      if (activeRes?.success && activeRes?.data) {
        const currentUserId = String(activeRes.userId || user?._id || '');
        const myAlert = activeRes.data.find((a) => {
          const alertUserId = String(a.user?._id || a.user?.id || a.user || '');
          return alertUserId === currentUserId;
        });

        if (myAlert) {
          setSosActive(true);
          setActiveAlertId(myAlert._id);
          if (myAlert.responders) {
            setResponders(
              myAlert.responders.map((r) => ({
                id: String(r.user?._id || r.user?.id || r.user || ''),
                name: r.user?.name || 'Emergency Contact',
                phone: r.user?.phone || '',
              }))
            );
          }
        } else {
          setSosActive(false);
          setResponders([]);
        }
      }
    } catch (err) {
      console.error('syncStatus error:', err);
    }
  };

  useEffect(() => {
    syncStatus();
    detectLocation();
  }, []);

  useEffect(() => {
    if (!socket || !user) return;

    socket.emit('join_user', user._id);

    const handleResponderUpdated = (data) => {
      console.log('Real-time responder updated:', data);
      const resp = data.responder;
      if (resp) {
        const respId = String(resp._id || resp.id || '');
        setResponders((prev) => {
          if (prev.some((r) => String(r.id) === respId)) return prev;
          return [
            ...prev,
            { id: respId, name: resp.name || 'Emergency Contact', phone: resp.phone || '' },
          ];
        });
      }
    };

    const handleSosResolved = (data) => {
      const resolvedUserId = String(data?.userId || '');
      const currentUserId = String(user._id || '');
      if (resolvedUserId === currentUserId) {
        setSosActive(false);
        setResponders([]);
        setResolveModalOpen(false);
        setMpinInput('');
      }
    };

    const handleSosTriggered = (data) => {
      const incomingUserId = String(data?.user?.id || data?.user?._id || data?.userId || '');
      if (incomingUserId === String(user._id)) {
        setSosActive(true);
      }
    };

    socket.on('responder_updated', handleResponderUpdated);
    socket.on('sos_resolved', handleSosResolved);
    socket.on('sos_triggered', handleSosTriggered);

    return () => {
      socket.off('responder_updated', handleResponderUpdated);
      socket.off('sos_resolved', handleSosResolved);
      socket.off('sos_triggered', handleSosTriggered);
    };
  }, [socket, user]);

  const detectLocation = () => {
    setGpsStatus('Detecting GPS location...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          });
          setGpsStatus('High-Accuracy GPS Sync Active');
        },
        (error) => {
          console.warn('Geolocation access denied:', error.message);
          setGpsStatus('GPS Denied - Fallback Coordinates');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsStatus('Browser Geolocation Unsupported');
    }
  };

  const handleTriggerSOS = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await apiRequest('/api/alerts/trigger', {
        method: 'POST',
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          triggerType: 'manual_sos',
        }),
      });

      if (res.success) {
        setSosActive(true);
        if (res.data?._id) {
          setActiveAlertId(res.data._id);
        }
      } else {
        setError(res.message || 'SOS dispatch failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const openResolveModal = () => {
    setError('');
    setMpinInput('');
    setResolveModalOpen(true);
  };

  const submitResolveSOS = async (e) => {
    if (e) e.preventDefault();
    if (!/^\d{4}$/.test(mpinInput.trim())) {
      setError('Please enter your 4-digit Safety MPIN.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await apiRequest('/api/alerts/resolve', {
        method: 'POST',
        body: JSON.stringify({ mpin: mpinInput.trim() }),
      });

      if (res.success) {
        setSosActive(false);
        setResponders([]);
        setResolveModalOpen(false);
        setMpinInput('');
      } else {
        setError(res.message || 'Incorrect MPIN or resolve failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Navigation header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">SOS Emergency Trigger</h1>
              <p className="text-sm text-slate-500 font-medium">Broadcast immediate danger signals to your guardians</p>
            </div>
          </div>
        </div>

        {/* Main Split Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left panel - Coordinates Details */}
          <div className="space-y-6 md:col-span-1">
            <div className="glass-panel p-6 space-y-4 shadow-sm border border-slate-200/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <MapPin className="w-5 h-5 text-blue-600" /> Location Context
              </h2>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GPS Mode Status</label>
                  <p className="text-xs font-bold text-slate-700">{gpsStatus}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={coords.lat}
                      onChange={(e) => setCoords({ ...coords, lat: Number(e.target.value) })}
                      className="w-full glass-input text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={coords.lng}
                      onChange={(e) => setCoords({ ...coords, lng: Number(e.target.value) })}
                      className="w-full glass-input text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <button
                  onClick={detectLocation}
                  className="w-full mt-2 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Crosshair className="w-3.5 h-3.5" /> Re-Scan GPS
                </button>
              </div>
            </div>

            {/* Emergency contacts summary card */}
            <div className="glass-panel p-6 space-y-4 shadow-sm border border-slate-200/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users className="w-5 h-5 text-slate-400" /> Guardians to Notify
              </h2>
              
              {guardians.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No emergency contacts configured.</p>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {guardians.map((g) => (
                    <div key={g._id} className="p-3 bg-white border border-slate-200/60 rounded-xl shadow-sm flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{g.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{g.phone}</p>
                      </div>
                      <span className="text-[9px] bg-blue-50 border border-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full uppercase">
                        {g.relationship || 'Guardian'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rescue Coordination Panel */}
            {sosActive && (
              <div className="glass-panel p-6 space-y-4 shadow-sm border border-red-200/50 bg-red-50/20">
                <div className="border-b border-red-100 pb-3">
                  <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> Rescue Coordination
                  </h2>
                </div>
                
                {responders.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 font-medium italic">
                    Waiting for emergency contacts to respond...
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    <p className="text-xs font-bold text-slate-700">{responders.length} contact(s) on the way:</p>
                    {responders.map((r, idx) => (
                      <div key={idx} className="p-3 bg-white border border-emerald-100 rounded-xl shadow-sm flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{r.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.phone}</p>
                        </div>
                        <span className="text-[9px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                          EN ROUTE
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel - SOS button ripple */}
          <div className="md:col-span-2 glass-panel p-8 flex flex-col items-center justify-center min-h-[400px] shadow-sm border border-slate-200/50 relative overflow-hidden">
            
            {/* Visual warning border if active */}
            {sosActive && (
              <div className="absolute inset-0 border-4 border-red-500/30 hazard-alert pointer-events-none rounded-2xl"></div>
            )}

            {error && (
              <div className="mb-6 w-full max-w-sm p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold text-center">
                {error}
              </div>
            )}

            {/* Pulsing button container */}
            <div className="relative flex justify-center items-center h-64 w-64">
              {sosActive && (
                <>
                  <div className="absolute w-56 h-56 rounded-full bg-red-500/10 border border-red-500/20 animate-ping"></div>
                  <div className="absolute w-44 h-44 rounded-full bg-red-500/15 border border-red-500/30 animate-pulse"></div>
                </>
              )}

              <button
                onClick={sosActive ? openResolveModal : handleTriggerSOS}
                disabled={loading}
                className={`w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg outline-none border-0 ${
                  sosActive 
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30' 
                    : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
                }`}
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <ShieldAlert className="w-8 h-8 mb-1.5 animate-bounce" />
                    <span className="font-extrabold text-2xl uppercase tracking-wider">
                      {sosActive ? 'RESOLVE' : 'SOS'}
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="text-center max-w-sm mt-4 space-y-2">
              <p className="text-sm font-bold text-slate-800">
                {sosActive ? '🚨 EMERGENCY ALARM ACTIVE' : 'TAP BUTTON TO EMIT SOS SIGNAL'}
              </p>
              <p className="text-xs text-slate-500 leading-normal">
                {sosActive 
                  ? 'Guardians are notified. Click RESOLVE and enter your MPIN to cancel warning signals.' 
                  : 'Requires browser geolocation access. Instantly updates emergency contacts.'}
              </p>
            </div>

          </div>

        </div>
      </div>

      {/* RESOLVE SOS MPIN MODAL */}
      {resolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <ShieldAlert className="w-5 h-5" />
                <span>Verify MPIN to Resolve SOS</span>
              </div>
              <button 
                onClick={() => setResolveModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitResolveSOS} className="space-y-4">
              <p className="text-xs text-slate-600">
                Enter your 4-digit Safety MPIN to confirm that you are safe and deactivate the emergency beacon.
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  4-Digit Safety MPIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={mpinInput}
                  onChange={(e) => setMpinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center tracking-[0.5em] text-2xl font-bold py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || mpinInput.length !== 4}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl shadow-md transition-all"
                >
                  {loading ? 'Verifying…' : 'Confirm Safe & Resolve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SosTrigger;
