import React, { useEffect, useState } from 'react';
import {
  CalendarDays, CheckCircle2, ChevronRight, Eye, EyeOff, KeyRound,
  LockKeyhole, LogOut, Mail, Phone, Save, Shield, Trash2, UserRound,
  Users, Pencil, Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function Profile() {
  const { user, updateProfile, changePassword, deleteAccount, logout, apiRequest } = useAuth();
  const [edit, setEdit] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ old: '', new: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [mpinOpen, setMpinOpen] = useState(false);
  const [mpinForm, setMpinForm] = useState({ password: '', newMpin: '', confirmMpin: '' });
  const [showMpinPassword, setShowMpinPassword] = useState(false);
  const [showNewMpin, setShowNewMpin] = useState(false);
  const [showConfirmMpin, setShowConfirmMpin] = useState(false);
  const [mpinLoading, setMpinLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', gender: '', bloodGroup: '', dob: '' });

  const notify = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    window.clearTimeout(window.__safeCalcProfileToast);
    window.__safeCalcProfileToast = window.setTimeout(() => setMessage(''), 4500);
  };

  useEffect(() => {
    setForm({
      name: user?.name || '',
      phone: user?.phone || '',
      gender: user?.gender || '',
      bloodGroup: user?.bloodGroup || '',
      dob: user?.dob ? String(user.dob).slice(0, 10) : '',
    });
  }, [user]);

  const loadContacts = async () => {
    setContactsLoading(true);
    try {
      const result = await apiRequest('/api/contacts');
      if (result.success) setContacts(result.data || []);
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => { loadContacts(); }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    const result = await updateProfile(form);
    if (!result.success) {
      notify(result.message || 'Profile update failed.', 'error');
      return;
    }
    notify('Profile details saved successfully.');
    setEdit(false);
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setPasswordLoading(true);
    try {
      const result = await changePassword(passwordForm.old, passwordForm.new);
      if (!result.success) throw new Error(result.message || 'Password update failed.');
      notify('Password updated successfully.');
      setPasswordForm({ old: '', new: '' });
    } catch (error) {
      notify(error.message || 'Password update failed.', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const resetMpin = async (event) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(mpinForm.newMpin)) return notify('New MPIN must contain exactly 4 digits.', 'error');
    if (mpinForm.newMpin !== mpinForm.confirmMpin) return notify('New MPIN and confirmation MPIN do not match.', 'error');
    if (!mpinForm.password) return notify('Enter your account password to save the MPIN.', 'error');

    setMpinLoading(true);
    try {
      const result = await apiRequest('/api/auth/reset-mpin', {
        method: 'PUT',
        body: JSON.stringify({ password: mpinForm.password, newMpin: mpinForm.newMpin }),
      });
      if (!result.success) throw new Error(result.message || 'Unable to save MPIN.');
      notify('Safety MPIN saved successfully. You can now resolve SOS and end travel.');
      setMpinForm({ password: '', newMpin: '', confirmMpin: '' });
      setMpinOpen(false);
    } catch (error) {
      notify(error.message || 'Unable to save MPIN.', 'error');
    } finally {
      setMpinLoading(false);
    }
  };

  const deleteUser = async () => {
    if (!window.confirm('Delete your account permanently? This cannot be undone.')) return;
    const result = await deleteAccount();
    if (!result.success) notify(result.message || 'Unable to delete account.', 'error');
  };

  return (
    <Layout title="My Profile">
      <div className="page-header profile-page-header">
        <div><span className="eyebrow">ACCOUNT & SECURITY</span><h1>My Profile</h1><p>Manage your personal details, password, Safety MPIN and emergency contacts.</p></div>
        <div className="profile-header-badge"><Shield size={15}/> Safety account</div>
      </div>

      {message && <div className={messageType === 'error' ? 'form-error page-message' : 'form-success page-message'}>{messageType === 'error' ? '⚠ ' : '✓ '}{message}</div>}

      <div className="profile-main-grid">
        <section className="panel profile-card">
          <div className="profile-hero profile-hero-large">
            <div className="profile-avatar"><UserRound size={30}/></div>
            <div className="profile-hero-copy"><span className="eyebrow">PERSONAL ACCOUNT</span><h2>{user?.name || 'Traveler'}</h2><div className="profile-email"><Mail size={13}/> {user?.email || '—'}</div></div>
            <button className="btn outline blue profile-edit-top" onClick={() => setEdit((value) => !value)}><Pencil size={15}/> {edit ? 'Cancel' : 'Edit profile'}</button>
          </div>

          {edit ? (
            <form className="stack-form" onSubmit={saveProfile}>
              <div className="form-section-label">PERSONAL DETAILS</div>
              <div className="profile-form-grid">
                <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required/></label>
                <label>Phone number<div className="input-icon"><Phone size={14}/><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required/></div></label>
                <label>Gender<select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label>
                <label>Blood group<select value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}><option value="">Select blood group</option>{['A+','A-','B+','B-','O+','O-','AB+','AB-'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label>Date of birth<div className="input-icon"><CalendarDays size={14}/><input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })}/></div></label>
                <label>Email<input value={user?.email || ''} disabled/></label>
              </div>
              <div className="profile-actions"><button className="btn primary" type="submit"><Save size={16}/> Save profile</button><button className="btn outline" type="button" onClick={() => setEdit(false)}>Cancel</button></div>
            </form>
          ) : (
            <>
              <div className="profile-info-grid">
                <InfoItem label="Full name" value={user?.name} icon={<UserRound size={14}/>}/>
                <InfoItem label="Email address" value={user?.email} icon={<Mail size={14}/>}/>
                <InfoItem label="Phone number" value={user?.phone} icon={<Phone size={14}/>}/>
                <InfoItem label="Gender" value={user?.gender} icon={<UserRound size={14}/>}/>
                <InfoItem label="Blood group" value={user?.bloodGroup} icon={<Shield size={14}/>}/>
                <InfoItem label="Date of birth" value={user?.dob ? String(user.dob).slice(0, 10) : ''} icon={<CalendarDays size={14}/>}/>
              </div>
              <div className="profile-note"><CheckCircle2 size={15}/><span>Your profile information is used to identify you during emergency safety events.</span></div>
            </>
          )}
        </section>

        <section className="panel profile-card security-card">
          <div className="panel-title profile-section-title"><LockKeyhole size={18}/><div><h2>Account security</h2><span>Password and Safety MPIN controls</span></div></div>
          <form className="stack-form" onSubmit={updatePassword}>
            <div className="form-section-label">CHANGE PASSWORD</div>
            <PasswordField label="Current password" value={passwordForm.old} onChange={(value) => setPasswordForm({ ...passwordForm, old: value })} visible={showCurrentPassword} onToggle={() => setShowCurrentPassword((value) => !value)}/>
            <PasswordField label="New password" value={passwordForm.new} onChange={(value) => setPasswordForm({ ...passwordForm, new: value })} visible={showNewPassword} onToggle={() => setShowNewPassword((value) => !value)} minLength={6}/>
            <button className="btn outline blue" type="submit" disabled={passwordLoading}><Shield size={16}/>{passwordLoading ? 'Updating…' : 'Update password'}</button>
          </form>

          <div className="security-divider"/>

          <div className="panel-title profile-section-title"><KeyRound size={18}/><div><h2>Safety MPIN</h2><span>4-digit PIN used for SOS resolution and ending travel</span></div></div>
          <div className="mpin-status"><div className="mpin-status-icon"><KeyRound size={17}/></div><div><strong>MPIN is securely stored</strong><span>The existing MPIN cannot be displayed. If you forgot it, verify your account password and create a new one.</span></div></div>

          {!mpinOpen ? (
            <button className="btn outline blue full" type="button" onClick={() => setMpinOpen(true)}><KeyRound size={16}/> Forgot MPIN? Reset MPIN</button>
          ) : (
            <form className="stack-form mpin-reset-form" onSubmit={resetMpin}>
              <div className="form-section-label">RESET SAFETY MPIN</div>
              <PasswordField label="Account password" value={mpinForm.password} onChange={(value) => setMpinForm({ ...mpinForm, password: value })} visible={showMpinPassword} onToggle={() => setShowMpinPassword((value) => !value)}/>
              <PinField label="New 4-digit MPIN" value={mpinForm.newMpin} onChange={(value) => setMpinForm({ ...mpinForm, newMpin: value })} visible={showNewMpin} onToggle={() => setShowNewMpin((value) => !value)}/>
              <PinField label="Confirm new MPIN" value={mpinForm.confirmMpin} onChange={(value) => setMpinForm({ ...mpinForm, confirmMpin: value })} visible={showConfirmMpin} onToggle={() => setShowConfirmMpin((value) => !value)}/>
              <div className="profile-actions"><button className="btn primary" type="submit" disabled={mpinLoading}><Save size={16}/>{mpinLoading ? 'Saving MPIN…' : 'Save MPIN'}</button><button className="btn outline" type="button" onClick={() => { setMpinOpen(false); setMpinForm({ password: '', newMpin: '', confirmMpin: '' }); }}>Cancel</button></div>
              <small className="security-help">Use exactly 4 digits. The MPIN is hashed on the server and is never returned to the website.</small>
            </form>
          )}
        </section>
      </div>

      <section className="panel profile-wide-card">
        <div className="profile-wide-header">
          <div className="panel-title profile-section-title"><Users size={18}/><div><h2>Emergency contacts</h2><span>Registered Safe Calc users who can receive app notifications</span></div></div>
          <a className="btn outline blue" href="/contacts">Manage contacts <ChevronRight size={15}/></a>
        </div>
        {contactsLoading ? <div className="empty-card">Loading emergency contacts…</div> : contacts.length === 0 ? (
          <div className="profile-empty"><Users size={24}/><strong>No emergency contacts added</strong><span>Add registered Safe Calc users so they can receive SOS notifications.</span><a className="btn primary" href="/contacts">Add emergency contacts</a></div>
        ) : (
          <div className="profile-contacts-grid">
            {contacts.slice(0, 10).map((contact, index) => (
              <div className="profile-contact-card" key={contact._id || index}>
                <div className="contact-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="profile-contact-info"><strong>{contact.name}</strong><span>{contact.relationship || 'Trusted person'}</span><span><Phone size={11}/> {contact.phone}</span><span className={contact.notificationReady ? 'contact-ready' : 'contact-not-ready'}>{contact.notificationReady ? '✓ App notifications ready' : '⚠ App notification not enabled'}</span></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="profile-bottom-grid">
        <section className="panel profile-small-card"><div className="panel-title profile-section-title"><Settings size={18}/><div><h2>Quick settings</h2><span>Manage your safety pages</span></div></div><a className="profile-link" href="/">Dashboard <ChevronRight size={15}/></a><a className="profile-link" href="/geofences">Safety zones <ChevronRight size={15}/></a><a className="profile-link" href="/history">Travel history <ChevronRight size={15}/></a></section>
        <section className="panel profile-small-card danger-panel"><div className="panel-title profile-section-title"><Shield size={18}/><div><h2>Account actions</h2><span>Sign out or permanently remove your account</span></div></div><div className="profile-actions"><button className="btn outline" onClick={logout}><LogOut size={16}/> Log out</button><button className="btn danger" onClick={deleteUser}><Trash2 size={16}/> Delete account</button></div></section>
      </div>
    </Layout>
  );
}

function InfoItem({ label, value, icon }) {
  return <div className="profile-info-item"><div className="info-item-icon">{icon}</div><div><span>{label}</span><strong>{value || 'Not specified'}</strong></div></div>;
}

function PasswordField({ label, value, onChange, visible, onToggle, minLength }) {
  return <label className="password-field-label">{label}<div className="password-input-wrap"><input type={visible ? 'text' : 'password'} value={value} minLength={minLength} onChange={(e) => onChange(e.target.value)} required/><button type="button" className="eye-btn" onClick={onToggle} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>;
}

function PinField({ label, value, onChange, visible, onToggle }) {
  return <label className="password-field-label">{label}<div className="password-input-wrap"><input type={visible ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" required/><button type="button" className="eye-btn" onClick={onToggle} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>;
}
