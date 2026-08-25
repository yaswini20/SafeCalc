import React, { useEffect, useState } from 'react';

import {
  Plus,
  Save,
  Trash2,
  Users,
  Phone,
  Mail,
  UserRound,
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const emptyContact = () => ({
  id: '',
  name: '',
  phone: '',
  email: '',
  relationship: '',
  isSafeCalcUser: false,
  notificationReady: false,
});

export default function Contacts() {
  const { apiRequest } = useAuth();

  const [rows, setRows] = useState([
    emptyContact(),
  ]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const loadContacts = async () => {
    setLoading(true);

    try {
      const response = await apiRequest('/api/contacts');

      if (response?.success) {
        if (response.data?.length) {
          setRows(
            response.data.map(
              (contact) => ({
                id: contact._id,
                name: contact.name || '',
                phone: contact.phone || '',
                email: contact.email || '',
                relationship:
                  contact.relationship || '',
                isSafeCalcUser:
                  Boolean(
                    contact.isSafeCalcUser
                  ),
                notificationReady:
                  Boolean(
                    contact.notificationReady
                  ),
              })
            )
          );
        } else {
          setRows([emptyContact()]);
        }
      }
    } catch (error) {
      setError(
        'Unable to load emergency contacts.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const update = (
    index,
    field,
    value
  ) => {
    setRows((previous) =>
      previous.map(
        (row, currentIndex) =>
          currentIndex === index
            ? {
                ...row,
                [field]: value,
                isSafeCalcUser: false,
                notificationReady: false,
              }
            : row
      )
    );
  };

  const addContact = () => {
    if (rows.length >= 10) {
      setError(
        'You can add up to 10 emergency contacts.'
      );
      return;
    }

    setError('');
    setRows((previous) => [
      ...previous,
      emptyContact(),
    ]);
  };

  const removeContact = async (index) => {

    const contact = rows[index];

    if (contact.id) {

      const response =
        await apiRequest(
          `/api/contacts/${contact.id}`,
          {
            method: 'DELETE',
          }
        );

      if (!response?.success) {
        setError(
          response?.message ||
            'Unable to remove contact.'
        );

        return;
      }
    }

    setRows((previous) =>
      previous.filter(
        (_, currentIndex) =>
          currentIndex !== index
      )
    );
  };

  const saveContacts = async () => {

    setError('');
    setSuccess('');

    const filled = rows.filter(
      (row) =>
        row.name.trim() ||
        row.phone.trim() ||
        row.email.trim()
    );

    for (const row of filled) {

      if (!row.name.trim()) {
        setError(
          'Please enter the contact name.'
        );
        return;
      }

      if (!row.phone.trim()) {
        setError(
          'Please enter the registered Safe Calc phone number.'
        );
        return;
      }
    }

    setSaving(true);

    try {

      for (const row of rows) {

        if (
          !row.name.trim() &&
          !row.phone.trim() &&
          !row.email.trim()
        ) {
          continue;
        }

        const payload = {
          name: row.name.trim(),
          phone: row.phone.trim(),
          email: (row.email || '')
            .trim()
            .toLowerCase(),
          relationship:
            row.relationship.trim(),
        };

        const response = row.id
          ? await apiRequest(
              `/api/contacts/${row.id}`,
              {
                method: 'PUT',
                body: JSON.stringify(
                  payload
                ),
              }
            )
          : await apiRequest(
              '/api/contacts',
              {
                method: 'POST',
                body: JSON.stringify(
                  payload
                ),
              }
            );

        if (!response?.success) {
          throw new Error(
            response?.message ||
              'Unable to save contact.'
          );
        }
      }

      setSuccess(
        'Emergency contacts saved successfully. They will receive Safe Calc app notifications when SOS is triggered.'
      );

      await loadContacts();

    } catch (error) {

      setError(
        error?.message ||
          'Unable to save emergency contacts.'
      );

    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Emergency Contacts">

      <div className="page-header">

        <div>
          <span className="eyebrow">
            TRUSTED PEOPLE
          </span>

          <h1>
            Emergency Contacts
          </h1>

          <p>
            Add registered Safe Calc users.
            No SMS or email is used for SOS.
          </p>
        </div>

        <button
          className="btn outline blue"
          onClick={addContact}
          disabled={
            rows.length >= 10
          }
        >
          <Plus size={16} />
          Add contact
        </button>

      </div>

      {error && (
        <div className="form-error page-message">
          {error}
        </div>
      )}

      {success && (
        <div className="form-success page-message">
          {success}
        </div>
      )}

      <div className="contacts-grid">

        {loading ? (

          <div className="panel empty-card">
            Loading contacts…
          </div>

        ) : (

          rows.map((contact, index) => (

            <div
              className="panel contact-panel"
              key={
                contact.id ||
                `contact-${index}`
              }
            >

              <div className="contact-head">

                <div className="contact-number">
                  {String(index + 1).padStart(
                    2,
                    '0'
                  )}
                </div>

                <div>
                  <strong>
                    Emergency contact{' '}
                    {index + 1}
                  </strong>

                  <span>
                    {contact.id
                      ? '✓ Registered Safe Calc user'
                      : 'Enter registered Safe Calc account details'}
                  </span>
                </div>

                {rows.length > 1 && (
                  <button
                    className="icon-danger"
                    onClick={() =>
                      removeContact(index)
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                )}

              </div>

              <label>
                Full name

                <div className="input-icon">

                  <UserRound size={15} />

                  <input
                    value={contact.name}
                    onChange={(event) =>
                      update(
                        index,
                        'name',
                        event.target.value
                      )
                    }
                    placeholder="Registered user's name"
                  />

                </div>

              </label>

              <label>
                Registered phone number

                <div className="input-icon">

                  <Phone size={15} />

                  <input
                    value={contact.phone}
                    onChange={(event) =>
                      update(
                        index,
                        'phone',
                        event.target.value
                      )
                    }
                    placeholder="Registered Safe Calc phone"
                    type="tel"
                  />

                </div>

              </label>

              <label>
                Registered email (Optional)

                <div className="input-icon">

                  <Mail size={15} />

                  <input
                    value={contact.email}
                    onChange={(event) =>
                      update(
                        index,
                        'email',
                        event.target.value
                      )
                    }
                    placeholder="Registered Safe Calc email (optional)"
                    type="email"
                  />

                </div>

              </label>

              <label>
                Relationship

                <input
                  value={
                    contact.relationship
                  }
                  onChange={(event) =>
                    update(
                      index,
                      'relationship',
                      event.target.value
                    )
                  }
                  placeholder="Parent / Friend / Sibling"
                />

              </label>

              {contact.id && (
                <div className="form-success">

                  <ShieldCheck
                    size={14}
                  />

                  Registered Safe Calc user.
                  App notifications can be
                  delivered when notifications
                  are enabled.

                </div>
              )}

              {!contact.id && (
                <div className="form-warning">
                  Safe Calc accounts matching this phone number will receive mobile app push notifications.
                </div>
              )}

            </div>

          ))
        )}

      </div>

      <div className="sticky-save">

        <div>
          <Users size={18} />

          <span>
            {rows.filter(
              (row) =>
                row.name &&
                row.phone
            ).length}{' '}
            contacts configured
          </span>
        </div>

        <button
          className="btn primary"
          onClick={saveContacts}
          disabled={saving}
        >
          <Save size={16} />

          {saving
            ? 'Saving…'
            : 'Save contacts'}
        </button>

      </div>

    </Layout>
  );
}