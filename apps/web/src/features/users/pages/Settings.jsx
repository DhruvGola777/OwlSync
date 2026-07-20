import React, { useState, useEffect } from 'react';
import { UAParser } from 'ua-parser-js';
import { api } from '../../../services/api';
import { useAuth } from '../../../providers/AuthProvider';

export default function Settings() {
  const { user, logout, checkAuth } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  if (!user) return null;

  return (
    <div className="settings-page" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#111827' }}>Account Settings</h1>
      
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '2rem' }}>
        {['profile', 'security', 'sessions', 'danger'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #4f46e5' : '2px solid transparent',
              color: activeTab === tab ? '#4f46e5' : '#6b7280',
              fontWeight: activeTab === tab ? '600' : '400',
              cursor: 'pointer',
              textTransform: 'capitalize',
              outline: 'none'
            }}
          >
            {tab === 'danger' ? 'Danger Zone' : tab}
          </button>
        ))}
      </div>

      <div className="tab-content" style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {activeTab === 'profile' && <ProfileTab user={user} checkAuth={checkAuth} />}
        {activeTab === 'security' && <SecurityTab user={user} checkAuth={checkAuth} />}
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'danger' && <DangerZoneTab logout={logout} />}
      </div>
    </div>
  );
}

function ProfileTab({ user, checkAuth }) {
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateProfile({ name, username });
      await checkAuth(); // refresh user data
      setMsg('Profile updated successfully!');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#111827' }}>Profile Information</h2>
      {msg && <p style={{ marginBottom: '1rem', color: msg.includes('success') ? '#10b981' : '#ef4444' }}>{msg}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '400px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none' }}
          />
        </div>
        <button disabled={loading} type="submit" style={{ padding: '0.75rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

function SecurityTab({ user, checkAuth }) {
  const [qrCode, setQrCode] = useState(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const data = await api.setup2FA();
      setQrCode(data.qrCodeUrl);
      setMsg('Please scan this QR code with your Authenticator app, then enter the 6-digit pin below.');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.verify2FA(token);
      await checkAuth(); // refresh user data
      setQrCode(null);
      setMsg('2FA has been enabled successfully!');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setLoading(true);
    try {
      await api.disable2FA();
      await checkAuth(); // refresh user data
      setMsg('2FA has been disabled successfully.');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#111827' }}>Security Settings</h2>
      <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>
        Two-Factor Authentication is currently{' '}
        <strong style={{ color: user?.isTwoFactorEnabled ? '#10b981' : '#6b7280' }}>
          {user?.isTwoFactorEnabled ? 'ENABLED' : 'DISABLED'}
        </strong>.
      </p>

      {user?.isTwoFactorEnabled ? (
        <button disabled={loading} onClick={handleDisable2FA} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
          {loading ? 'Disabling...' : 'Disable 2FA'}
        </button>
      ) : !qrCode ? (
        <button disabled={loading} onClick={handleSetup2FA} style={{ padding: '0.75rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
          {loading ? 'Setting up...' : 'Set up 2FA'}
        </button>
      ) : null}

      {msg && <p style={{ margin: '1rem 0', color: msg.includes('success') ? '#10b981' : (qrCode ? '#3b82f6' : '#ef4444') }}>{msg}</p>}

      {qrCode && (
        <div style={{ marginTop: '1rem' }}>
          <img src={qrCode} alt="2FA QR Code" style={{ border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '1.25rem', padding: '1rem', background: 'white' }} />
          <form onSubmit={handleVerify2FA} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="000000"
              value={token} 
              onChange={e => setToken(e.target.value)}
              style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', width: '120px', letterSpacing: '2px', textAlign: 'center', fontSize: '1.125rem' }}
              maxLength={6}
            />
            <button disabled={loading || token.length !== 6} type="submit" style={{ padding: '0.75rem 1.5rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: (loading || token.length !== 6) ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: (loading || token.length !== 6) ? 0.7 : 1 }}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SessionsTab() {
  const [sessions, setSessions] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data.sessions || []);
    } catch (err) {
      setMsg('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (id) => {
    try {
      await api.revokeSession(id);
      await loadSessions();
      setMsg('Session revoked successfully');
    } catch (err) {
      setMsg(err.message);
    }
  };

  const parseUA = (uaString) => {
    const parser = new UAParser(uaString);
    const result = parser.getResult();
    const browser = result.browser.name ? `${result.browser.name} ${result.browser.major || ''}` : 'Unknown Browser';
    const os = result.os.name ? `${result.os.name} ${result.os.version || ''}` : 'Unknown OS';
    return `${browser} on ${os}`;
  };

  if (loading) return <p>Loading sessions...</p>;

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#111827' }}>Active Sessions</h2>
      {msg && <p style={{ marginBottom: '1rem', color: msg.includes('success') ? '#10b981' : '#ef4444' }}>{msg}</p>}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sessions.map(s => (
          <div key={s.id} style={{ padding: '1.25rem', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#374151' }}>{parseUA(s.userAgent)}</p>
              <p style={{ margin: '0', color: '#6b7280', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                IP: {s.ipAddress === '::1' ? 'localhost (::1)' : s.ipAddress}
              </p>
            </div>
            <button onClick={() => handleRevoke(s.id)} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
              Revoke
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p style={{ color: '#6b7280' }}>No active sessions found.</p>}
      </div>
    </div>
  );
}

function DangerZoneTab({ logout }) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.deleteAccount();
      logout();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#dc2626' }}>Danger Zone</h2>
      <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>Once you delete your account, there is no going back. Please be certain.</p>
      
      {!confirm ? (
        <button onClick={() => setConfirm(true)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
          Delete Account
        </button>
      ) : (
        <div style={{ padding: '1.5rem', border: '1px solid #ef4444', borderRadius: '8px', background: '#fef2f2' }}>
          <p style={{ margin: '0 0 1rem 0', color: '#991b1b', fontWeight: '600' }}>Are you absolutely sure?</p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button disabled={loading} onClick={handleDelete} style={{ padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
              {loading ? 'Deleting...' : 'Yes, Delete My Account'}
            </button>
            <button disabled={loading} onClick={() => setConfirm(false)} style={{ padding: '0.75rem 1.5rem', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
