import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  MapPin,
  Phone,
  Route,
  ShieldAlert,
  Users,
  UserRound,
  RefreshCw,
  LocateFixed,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Layout from '../components/Layout';
import DashboardMap from '../components/DashboardMap';

export default function Dashboard() {
  const { user, apiRequest, API } = useAuth();
  const { socket } = useSocket();

  const [alerts, setAlerts] = useState([]);
  const [journey, setJourney] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [safePlaces, setSafePlaces] = useState([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState(null);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [mpin, setMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinSeconds, setCheckinSeconds] = useState(300);

  const getUserId = useCallback((userObj) => {
    if (!userObj) return '';
    if (typeof userObj === 'string') return userObj;
    return String(userObj._id || userObj.id || '');
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(window.__dashboardToastTimer);
    window.__dashboardToastTimer = window.setTimeout(() => {
      setToast('');
    }, 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [alertsRes, journeyRes, contactsRes, safePlacesRes] =
        await Promise.all([
          apiRequest('/api/alerts/active'),
          apiRequest('/api/journey/active'),
          apiRequest('/api/contacts'),
          apiRequest('/api/safeplaces'),
        ]);

      if (alertsRes?.success) setAlerts(alertsRes.data || []);
      if (journeyRes?.success) setJourney(journeyRes.data || null);
      if (contactsRes?.success) setContacts(contactsRes.data || []);
      if (safePlacesRes?.success) setSafePlaces(safePlacesRes.data || []);
    } catch (error) {
      console.error('Dashboard sync error:', error);
      notify('Unable to synchronize with the safety server.');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, notify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /*
   * REAL-TIME SOS & JOURNEY EVENT STREAM
   */
  useEffect(() => {
    if (!socket || !user?._id) return;

    socket.emit('join_user', user._id);

    const handleSosTriggered = (data) => {
      const alertId = data.alertId || data._id;
      const incomingUserId = data?.user?.id || data?.user?._id || data?.userId;

      setAlerts((prev) => {
        if (prev.some((a) => String(a._id) === String(alertId))) {
          return prev;
        }
        return [
          {
            _id: alertId,
            user: data.user,
            journey: data.journey,
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            triggerType: data.triggerType,
            createdAt: data.createdAt || new Date(),
            responders: [],
          },
          ...prev,
        ];
      });

      if (String(incomingUserId) === String(user._id)) {
        notify('🚨 Your SOS alert is active. Emergency contacts have been notified.');
      } else {
        notify(`🚨 EMERGENCY ALERT: ${data.user?.name || 'A contact'} needs immediate help!`);
      }
    };

    const handleSosResolved = (data) => {
      const resolvedAlertId = data?.alertId;
      const resolvedUserId = data?.userId;

      setAlerts((prev) =>
        prev.filter((a) => {
          if (resolvedAlertId && String(a._id) === String(resolvedAlertId)) return false;
          if (resolvedUserId && getUserId(a.user) === String(resolvedUserId)) return false;
          return true;
        })
      );

      if (String(resolvedUserId) === String(user._id)) {
        setResolveOpen(false);
        setMpin('');
        setShowMpin(false);
        notify('✅ Your emergency SOS was resolved.');
      }
    };

    const handleJourneyStarted = (data) => {
      if (String(data.userId) === String(user._id)) {
        setJourney({
          _id: data.journeyId,
          destinationName: data.destinationName,
          travelMode: data.travelMode,
          vehicleNumber: data.vehicleNumber,
          expectedReachTime: data.expectedReachTime,
          status: 'active',
        });
        notify('📍 Monitored journey started.');
      }
    };

    const handleJourneyCompleted = (data) => {
      if (String(data.userId) === String(user._id)) {
        setJourney(null);
        notify('✅ Journey completed safely.');
      }
    };

    const handleJourneyUpdated = (data) => {
      if (String(data.userId) === String(user._id)) {
        setJourney((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentLatitude: data.latitude,
            currentLongitude: data.longitude,
          };
        });
      }
    };

    const handleCheckinPrompt = (data) => {
      setCheckinSeconds(Number(data?.secondsRemaining || 300));
      setCheckinOpen(true);
    };

    const handleCheckinAlert = (data) => {
      notify('⚠️ Expected arrival time reached. Grace period active.');
    };

    const handleResponderUpdated = (data) => {
      setAlerts((prev) =>
        prev.map((a) => {
          if (String(a._id) === String(data.alertId)) {
            const responders = a.responders || [];
            const responderId = data.responder?._id || data.responder?.id;
            const exists = responders.some(
              (r) => getUserId(r.user) === String(responderId)
            );
            if (!exists) {
              return {
                ...a,
                responders: [
                  ...responders,
                  { user: data.responder, status: data.status, respondedAt: new Date() },
                ],
              };
            }
          }
          return a;
        })
      );
      if (data.responder?.name) {
        notify(`🛡️ ${data.responder.name} is responding to the emergency.`);
      }
    };

    socket.on('sos_triggered', handleSosTriggered);
    socket.on('nearby_sos_alert', handleSosTriggered);
    socket.on('emergency_escalated', handleSosTriggered);
    socket.on('sos_resolved', handleSosResolved);
    socket.on('journey_started', handleJourneyStarted);
    socket.on('journey_completed', handleJourneyCompleted);
    socket.on('journey_updated', handleJourneyUpdated);
    socket.on('trigger_mpin_prompt', handleCheckinPrompt);
    socket.on('notify_check_in_alert', handleCheckinAlert);
    socket.on('responder_updated', handleResponderUpdated);

    return () => {
      socket.off('sos_triggered', handleSosTriggered);
      socket.off('nearby_sos_alert', handleSosTriggered);
      socket.off('emergency_escalated', handleSosTriggered);
      socket.off('sos_resolved', handleSosResolved);
      socket.off('journey_started', handleJourneyStarted);
      socket.off('journey_completed', handleJourneyCompleted);
      socket.off('journey_updated', handleJourneyUpdated);
      socket.off('trigger_mpin_prompt', handleCheckinPrompt);
      socket.off('notify_check_in_alert', handleCheckinAlert);
      socket.off('responder_updated', handleResponderUpdated);
    };
  }, [socket, user?._id, notify, getUserId]);

  const currentUserId = useMemo(() => {
    return String(user?._id || user?.id || '');
  }, [user]);

  // Current user's own active SOS alert
  const myAlert = useMemo(() => {
    if (!currentUserId) return null;
    return alerts.find((alert) => {
      const uid = getUserId(alert.user) || String(alert.userId || '');
      return uid === currentUserId;
    });
  }, [alerts, currentUserId, getUserId]);

  // Incoming alerts from contacts where current user is the guardian
  const guardianAlerts = useMemo(() => {
    if (!currentUserId) return [];
    return alerts.filter((alert) => {
      const uid = getUserId(alert.user) || String(alert.userId || '');
      return uid !== currentUserId;
    });
  }, [alerts, currentUserId, getUserId]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  }, []);

  /*
   * RESOLVE SOS
   */
  const resolveSOS = async () => {
    if (!myAlert) {
      setResolveOpen(false);
      return;
    }

    if (!/^\d{4}$/.test(mpin)) {
      notify('Enter your 4-digit MPIN.');
      return;
    }

    setResolving(true);

    try {
      const response = await apiRequest('/api/alerts/resolve', {
        method: 'POST',
        body: JSON.stringify({ mpin: String(mpin) }),
      });

      if (!response?.success) {
        notify(response?.message || 'Incorrect MPIN. SOS is still active.');
        return;
      }

      setAlerts((prev) =>
        prev.filter((a) => getUserId(a.user) !== String(user._id))
      );
      setResolveOpen(false);
      setMpin('');
      setShowMpin(false);
      notify('✅ SOS resolved. You are marked safe.');
      refresh();
    } catch (error) {
      console.error(error);
      notify('Unable to resolve SOS. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  /*
   * RESPOND TO CONTACT'S SOS
   */
  const respondToAlert = async (alertId) => {
    try {
      const response = await apiRequest(`/api/alerts/${alertId}/respond`, {
        method: 'POST',
      });
      if (response?.success) {
        notify('🛡️ You are marked as responding.');
        setAlerts((prev) =>
          prev.map((a) => (String(a._id) === String(alertId) ? response.data : a))
        );
      } else {
        notify(response?.message || 'Unable to respond.');
      }
    } catch (error) {
      notify('Failed to respond to alert.');
    }
  };

  /*
   * END TRAVEL
   */
  const endTravel = async () => {
    if (!journey) return;

    const pin = window.prompt('Enter your 4-digit MPIN to end travel safely:');
    if (pin === null) return;

    if (!/^\d{4}$/.test(pin)) {
      notify('Enter a valid 4-digit MPIN.');
      return;
    }

    try {
      const response = await apiRequest('/api/journey/end', {
        method: 'POST',
        body: JSON.stringify({ mpin: String(pin) }),
      });

      if (!response?.success) {
        notify(response?.message || 'Unable to end travel.');
        return;
      }

      setJourney(null);
      notify('✅ Travel ended safely.');
    } catch (error) {
      console.error(error);
      notify('Unable to end travel.');
    }
  };

  /*
   * UPDATE LIVE LOCATION
   */
  const updateLocation = async () => {
    if (!journey) return;

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const response = await apiRequest('/api/journey/update-location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });

      if (!response?.success) {
        notify(response?.message || 'Unable to update location.');
        return;
      }

      setJourney((prev) =>
        prev
          ? {
              ...prev,
              currentLatitude: position.coords.latitude,
              currentLongitude: position.coords.longitude,
            }
          : prev
      );
      notify('📍 Current location updated.');
    } catch (error) {
      notify(
        error?.code === 1
          ? 'Location permission is required.'
          : 'Unable to update location.'
      );
    }
  };

  /*
   * SUBMIT CHECK-IN
   */
  const submitCheckin = async (action) => {
    if (!/^\d{4}$/.test(mpin)) {
      notify('Enter your 4-digit MPIN.');
      return;
    }

    setResolving(true);

    try {
      const response = await apiRequest('/api/journey/check-in', {
        method: 'POST',
        body: JSON.stringify({
          mpin: String(mpin),
          action,
        }),
      });

      if (!response?.success) {
        notify(response?.message || 'Incorrect MPIN.');
        return;
      }

      setCheckinOpen(false);
      setMpin('');
      setShowMpin(false);

      if (action === 'complete') {
        setJourney(null);
        notify('✅ Trip finished safely.');
      } else {
        setJourney(response.data);
        notify('Journey extended by 15 minutes.');
      }
    } catch (error) {
      notify('Unable to process safety check-in.');
    } finally {
      setResolving(false);
    }
  };

  const onSosTriggerSuccess = useCallback((newAlert) => {
    setAlerts((prev) => [newAlert, ...prev]);
  }, []);

  return (
    <Layout title="Dashboard">
      {/* HEADER */}
      <div className="dashboard-head">
        <div>
          <span className="eyebrow">PERSONAL SAFETY</span>
          <h1>
            {greeting}, {user?.name?.split(' ')[0] || 'Traveler'} 👋
          </h1>
          <p>
            Stay safe. Your Safe Calc contacts receive app notifications when
            SOS is triggered.
          </p>
        </div>

        <Link to="/profile" className="profile-float" aria-label="Profile">
          <UserRound size={19} />
        </Link>
      </div>

      {/* GUARDIAN ALERTS BANNER (If contacts triggered SOS) */}
      {guardianAlerts.length > 0 && (
        <section className="section">
          <div className="section-title">
            <span className="eyebrow" style={{ color: '#ff6262' }}>
              GUARDIAN ALERTS
            </span>
            <h2>🚨 Emergency Alerts from Your Contacts</h2>
          </div>
          <div className="alert-list">
            {guardianAlerts.map((alert) => {
              const isResponding = alert.responders?.some(
                (r) => String(r.user?._id || r.user?.id || r.user) === String(user?._id)
              );
              return (
                <div className="log-card" key={alert._id}>
                  <div>
                    <strong>🚨 Emergency SOS from {alert.user?.name || 'Contact'}</strong>
                    <span>
                      {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : ''} ·{' '}
                      {Number(alert.latitude).toFixed(5)}, {Number(alert.longitude).toFixed(5)}
                    </span>
                    {alert.journey?.destinationName && (
                      <span style={{ marginTop: '2px', display: 'block', color: '#ff9999' }}>
                        Heading to: {alert.journey.destinationName}
                      </span>
                    )}
                  </div>
                  <div className="log-actions">
                    <a
                      className="btn outline blue"
                      style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      href={`https://www.google.com/maps/search/?api=1&query=${alert.latitude},${alert.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={13} />
                      Google Maps 🗺️
                    </a>
                    <button
                      className="text-action"
                      onClick={() =>
                        setSelected({
                          lat: alert.latitude,
                          lng: alert.longitude,
                        })
                      }
                    >
                      Show on map
                    </button>
                    {alert.user?.phone && (
                      <a href={`tel:${alert.user.phone}`} className="call-btn" title={`Call ${alert.user.phone}`}>
                        <Phone size={15} />
                      </a>
                    )}
                    <button
                      className={`btn ${isResponding ? 'success' : 'primary'}`}
                      style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                      disabled={isResponding}
                      onClick={() => respondToAlert(alert._id)}
                    >
                      <ShieldCheck size={14} />
                      {isResponding ? 'Responding' : 'Respond'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* EMERGENCY SECTION */}
      <section className="section sos-section">
        <div className="section-title">
          <span className="eyebrow">EMERGENCY</span>
          <h2>Emergency SOS</h2>
        </div>

        <div className={`sos-panel ${myAlert ? 'active' : ''}`}>
          <div className="sos-info">
            <div className="sos-icon">
              <ShieldAlert size={23} />
            </div>
            <div>
              <strong>
                {myAlert ? 'Emergency Alert Active' : 'Need immediate help?'}
              </strong>
              <span>
                {myAlert
                  ? 'Verify your MPIN to stop the emergency alert.'
                  : 'Tap SOS only when you need emergency assistance.'}
              </span>
            </div>
          </div>

          {myAlert ? (
            <button
              className="btn success"
              onClick={() => {
                setMpin('');
                setShowMpin(false);
                setResolveOpen(true);
              }}
            >
              <CheckCircle2 size={17} />
              Resolve SOS
            </button>
          ) : (
            <SosCountdownButton
              apiRequest={apiRequest}
              notify={notify}
              onSuccess={onSosTriggerSuccess}
            />
          )}
        </div>

        {/* RESCUE COORDINATION & RESPONDERS DISPLAY WHEN SOS IS ACTIVE */}
        {myAlert && (
          <div className="rescue-coordination-card" style={{ marginTop: '16px', background: '#1e293b', padding: '16px', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: '700', fontSize: '14px' }}>
                <ShieldCheck size={18} />
                <span>Rescue Coordination & Responders</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="text-action"
                  style={{ fontSize: '12px' }}
                  onClick={() =>
                    setSelected({
                      lat: myAlert.latitude,
                      lng: myAlert.longitude,
                    })
                  }
                >
                  Show on map 🗺️
                </button>
              </div>
            </div>

            {(!myAlert.responders || myAlert.responders.length === 0) ? (
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>
                ⏳ Emergency beacon active. Waiting for guardians/contacts to respond...
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#e2e8f0' }}>
                  {myAlert.responders.length} contact(s) responded & on the way:
                </span>
                {myAlert.responders.map((r, index) => {
                  const respUser = r.user || {};
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#0f172a',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13px', color: '#f8fafc', display: 'block' }}>
                          {respUser.name || 'Emergency Contact'}
                        </strong>
                        {respUser.phone && (
                          <a
                            href={`tel:${respUser.phone}`}
                            style={{ fontSize: '11px', color: '#38bdf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                          >
                            <Phone size={11} /> {respUser.phone}
                          </a>
                        )}
                      </div>
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                        }}
                      >
                        EN ROUTE
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* STATISTICS */}
      <section className="stats-grid">
        <Stat
          icon={<ShieldAlert />}
          tone="red"
          label="Safety Status"
          value={myAlert ? 'Emergency Active' : 'You are safe'}
          detail={myAlert ? 'Rescue coordination active' : 'No active emergency'}
        />
        <Stat
          icon={<Route />}
          tone="blue"
          label="Current Journey"
          value={journey ? 'Journey Active' : 'No active journey'}
          detail={journey ? journey.destinationName : 'Start a monitored trip'}
        />
        <Stat
          icon={<Users />}
          tone="green"
          label="Emergency Contacts"
          value={String(contacts.length)}
          detail={
            contacts.length
              ? 'Registered Safe Calc contacts'
              : 'Add trusted people'
          }
        />
      </section>

      {/* CURRENT JOURNEY */}
      <section className="section">
        <div className="section-title">
          <span className="eyebrow">TRAVEL SAFETY</span>
          <h2>
            Current Journey <Link to="/journey">Manage Journey →</Link>
          </h2>
        </div>

        {journey ? (
          <div className="journey-card">
            <div className="journey-main">
              <div className="place-icon">
                <MapPin size={20} />
              </div>
              <div>
                <span className="eyebrow">DESTINATION</span>
                <h3>{journey.destinationName}</h3>
                <div className="journey-meta">
                  <span>Mode: {journey.travelMode}</span>
                  <span>
                    Expected:{' '}
                    {journey.expectedReachTime
                      ? new Date(journey.expectedReachTime).toLocaleTimeString(
                          [],
                          { hour: '2-digit', minute: '2-digit' }
                        )
                      : '—'}
                  </span>
                  <span className={`status-chip ${journey.status}`}>
                    {String(journey.status || '').replaceAll('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="journey-actions">
              <button className="btn outline blue" onClick={updateLocation}>
                <LocateFixed size={15} />
                Update Location
              </button>
              <button className="btn outline green" onClick={endTravel}>
                <CheckCircle2 size={15} />
                End Travel
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-card">
            <Route size={27} />
            <div>
              <strong>No active journey</strong>
              <span>Start a monitored trip and share your live location.</span>
            </div>
            <Link className="btn primary" to="/journey">
              Plan Journey
            </Link>
          </div>
        )}
      </section>

      {/* QUICK ACCESS */}
      <section className="section">
        <div className="section-title">
          <span className="eyebrow">QUICK ACCESS</span>
          <h2>Safety Tools</h2>
        </div>

        <div className="quick-grid">
          <Quick
            to="/journey"
            icon={<Route />}
            tone="red"
            title="Plan Journey"
            text="Start monitored travel"
          />
          <Quick
            to="/contacts"
            icon={<Users />}
            tone="blue"
            title="Emergency Contacts"
            text="Manage trusted people"
          />
          <Quick
            to="/geofences"
            icon={<MapPin />}
            tone="green"
            title="Safety Zones"
            text="Manage safe locations"
          />
          <Quick
            to="/history"
            icon={<RefreshCw />}
            tone="purple"
            title="Travel History"
            text="View previous journeys"
          />
        </div>
      </section>

      {/* SAFETY MAP */}
      <section className="section">
        <div className="section-title">
          <div>
            <span className="eyebrow">LIVE LOCATION</span>
            <h2>Safety Map</h2>
          </div>
          <button className="text-action" onClick={refresh}>
            Refresh map
          </button>
        </div>

        <DashboardMap
          activeAlerts={alerts}
          activeJourneys={journey ? [journey] : []}
          safePlaces={safePlaces}
          selectedLocation={selected}
        />
      </section>


      {/* TOAST NOTIFICATION */}
      {toast && <div className="toast">{toast}</div>}

      {/* SAFETY CHECK-IN MODAL */}
      {checkinOpen && (
        <CheckinModal
          seconds={checkinSeconds}
          mpin={mpin}
          setMpin={setMpin}
          showMpin={showMpin}
          setShowMpin={setShowMpin}
          resolving={resolving}
          onSubmit={submitCheckin}
        />
      )}

      {/* RESOLVE SOS MODAL */}
      {resolveOpen && myAlert && (
        <div className="modal-backdrop">
          <div className="modal">
            <button
              className="modal-x"
              onClick={() => {
                if (resolving) return;
                setResolveOpen(false);
                setMpin('');
                setShowMpin(false);
              }}
            >
              ×
            </button>

            <div className="modal-icon red">
              <ShieldAlert />
            </div>

            <h2>Resolve SOS</h2>
            <p>
              Enter your 4-digit MPIN to confirm that you are safe and stop the
              active emergency alert.
            </p>

            <MpinInput
              value={mpin}
              onChange={setMpin}
              visible={showMpin}
              setVisible={setShowMpin}
              disabled={resolving}
            />

            <button
              className="btn success full"
              disabled={resolving || !/^\d{4}$/.test(mpin)}
              onClick={resolveSOS}
            >
              {resolving ? 'Verifying…' : 'Verify & Resolve SOS'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

/**
 * Isolated Countdown Button to keep timer ticks localized.
 */
function SosCountdownButton({ apiRequest, notify, onSuccess }) {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!count) return;

    const timer = window.setInterval(() => {
      setCount((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          triggerSos();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [count]);

  const triggerSos = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const response = await apiRequest('/api/alerts/trigger', {
        method: 'POST',
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          triggerType: 'manual_sos',
        }),
      });

      if (!response?.success) {
        notify(response?.message || 'Unable to trigger SOS.');
        return;
      }

      notify('🚨 SOS sent. Emergency contacts have been notified.');
      if (response.data) {
        onSuccess(response.data);
      }
    } catch (error) {
      notify(
        error?.code === 1
          ? 'Location permission is required to send SOS.'
          : 'Unable to send SOS.'
      );
    } finally {
      setBusy(false);
    }
  };

  const startCountdown = () => {
    if (busy) return;
    const duration = Number(localStorage.getItem('countdownDuration') || 5);
    setCount([3, 5, 10].includes(duration) ? duration : 5);
  };

  const cancelCountdown = () => {
    setCount(0);
    notify('SOS countdown cancelled.');
  };

  return (
    <button
      className="btn danger sos-send"
      disabled={busy}
      onClick={count ? cancelCountdown : startCountdown}
    >
      {count ? (
        `Sending SOS in ${count}s — Tap to cancel`
      ) : busy ? (
        'Sending…'
      ) : (
        <>
          <AlertTriangle size={17} />
          SEND SOS
        </>
      )}
    </button>
  );
}

/**
 * Isolated Checkin Modal.
 */
function CheckinModal({
  seconds: initialSeconds,
  mpin,
  setMpin,
  showMpin,
  setShowMpin,
  resolving,
  onSubmit,
}) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((val) => (val <= 1 ? 0 : val - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon red">
          <ShieldAlert />
        </div>

        <h2>Safety Check-In Required</h2>
        <p>
          Your expected arrival time has passed. Enter your MPIN to finish
          safely or extend the journey.
        </p>

        <div className="checkin-timer">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </div>

        <MpinInput
          value={mpin}
          onChange={setMpin}
          visible={showMpin}
          setVisible={setShowMpin}
          disabled={resolving}
        />

        <div className="modal-actions">
          <button
            className="btn success full"
            disabled={resolving}
            onClick={() => onSubmit('complete')}
          >
            Complete safely
          </button>

          <button
            className="btn outline blue full"
            disabled={resolving}
            onClick={() => onSubmit('extend')}
          >
            Extend 15 min
          </button>
        </div>
      </div>
    </div>
  );
}

function MpinInput({ value, onChange, visible, setVisible, disabled }) {
  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '12px' }}>
      <input
        className="mpin-field"
        inputMode="numeric"
        maxLength={4}
        type={visible ? 'text' : 'password'}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, '').slice(0, 4))
        }
        placeholder="••••"
        autoFocus
        style={{ width: '100%', paddingRight: '45px' }}
      />

      <button
        type="button"
        onClick={() => setVisible(!visible)}
        disabled={disabled}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          border: 0,
          background: 'transparent',
          color: '#7d8790',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

const Stat = React.memo(function Stat({ icon, tone, label, value, detail }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
});

const Quick = React.memo(function Quick({ to, icon, tone, title, text }) {
  return (
    <Link to={to} className="quick-card">
      <div className={`quick-icon ${tone}`}>{icon}</div>
      <strong>{title}</strong>
      <span>{text}</span>
    </Link>
  );
});