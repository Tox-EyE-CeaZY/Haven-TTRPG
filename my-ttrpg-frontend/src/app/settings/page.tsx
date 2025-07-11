// src/app/settings/page.tsx
'use client';

import { useState } from 'react'; // For managing toggle states
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// A simple toggle switch component (can be moved to a shared components folder later)
interface ToggleSwitchProps {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, enabled, onChange, disabled = false }) => (
  <label className={`flex items-center justify-between py-3 px-4 rounded-md ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-600'} bg-gray-700 transition-colors`}>
    <span className="text-gray-200">{label}</span>
    <div className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${disabled ? 'cursor-not-allowed' : ''}`}
      onClick={(e) => { if (disabled) e.preventDefault(); else onChange(!enabled); }}
    >
      <span className={`inline-block w-4 h-4 transform transition-transform bg-white rounded-full ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      <span className={`absolute inset-0 h-full w-full rounded-full transition-colors ${enabled ? 'bg-indigo-500' : 'bg-gray-500'}`} />
    </div>
  </label>
);

export default function SettingsPage() {
  const router = useRouter();
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [errorSettings, setErrorSettings] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Placeholder states for toggles
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [initialEmailPref, setInitialEmailPref] = useState(false); // To track initial state
  const [darkMode, setDarkMode] = useState(true); // Assuming a dark mode default for the app

  useEffect(() => {
    // Protect this page - redirect if not logged in
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login?message=Please login to access settings');
    }

    const fetchUserSettings = async () => {
      setLoadingSettings(true);
      setErrorSettings(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          if (response.status === 401) router.push('/login?message=Session expired');
          throw new Error('Failed to fetch user settings');
        }
        const userData = await response.json();
        setEmailNotifications(userData.email_notifications_enabled ?? false);
        setInitialEmailPref(userData.email_notifications_enabled ?? false);
        // Set other settings if fetched, e.g., inAppNotifications (currently hardcoded)
      } catch (err: any) {
        setErrorSettings(err.message);
      } finally {
        setLoadingSettings(false);
      }
    };
    if (token) {
      fetchUserSettings();
    } else { setLoadingSettings(false); } // If no token, stop loading
  }, [router]);

  const handleEmailNotificationChange = async (enabled: boolean) => {
    setEmailNotifications(enabled);
    setSuccessMessage(null);
    setErrorSettings(null);
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_notifications_enabled: enabled }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to update email notification settings');
      }
      setSuccessMessage('Email notification settings updated!');
      setInitialEmailPref(enabled); // Update initial state after successful save
    } catch (err: any) {
      setErrorSettings(err.message);
      setEmailNotifications(initialEmailPref); // Revert on error
    }
  };

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 md:p-8">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8">
            <Link href="/" className="text-indigo-400 hover:text-indigo-200 transition-colors">
                &larr; Back to Homepage
            </Link>
        </div>
        <h1 className="text-4xl font-bold text-indigo-400 mb-10 text-center">Settings</h1>

        {loadingSettings && <p className="text-center text-gray-400">Loading settings...</p>}
        {errorSettings && <p className="text-center text-red-400 bg-red-900 p-2 rounded mb-4">{errorSettings}</p>}
        {successMessage && <p className="text-center text-green-400 bg-green-900 p-2 rounded mb-4">{successMessage}</p>}

        {/* User Account Control */}
        <section className="mb-10 p-6 bg-gray-750 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-indigo-300 mb-6">User Account Control</h2>
          <div className="space-y-4">
            <Link href="/profile" className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-5 rounded-md transition-colors">
              Go to My Profile
            </Link>
            <button disabled className="w-full bg-gray-600 text-gray-400 font-semibold py-3 px-5 rounded-md cursor-not-allowed opacity-70">
              Change Password (Coming Soon)
            </button>
            <button disabled className="w-full bg-gray-600 text-gray-400 font-semibold py-3 px-5 rounded-md cursor-not-allowed opacity-70">
              Manage Email Preferences (Coming Soon)
            </button>
            <button disabled className="w-full bg-red-700 hover:bg-red-800 text-red-200 font-semibold py-3 px-5 rounded-md cursor-not-allowed opacity-70">
              Delete Account (Coming Soon)
            </button>
          </div>
        </section>

        {/* Notifications Settings */}
        <section className="mb-10 p-6 bg-gray-750 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-indigo-300 mb-6">Notifications</h2>
          <div className="space-y-3">
            <ToggleSwitch
              label="In-App Notifications"
              enabled={inAppNotifications}
              onChange={setInAppNotifications} // This would need its own backend logic
              disabled // Keep disabled until backend for this specific setting is ready
            />
            <p className="text-xs text-gray-400 px-1">Receive alerts for new messages, game updates, etc., within the app.</p>

            <ToggleSwitch
              label="Email Notifications"
              enabled={emailNotifications}
              onChange={handleEmailNotificationChange}
              disabled={loadingSettings}
            />
            <p className="text-xs text-gray-400 px-1">Get emails for important events like game invitations or direct message summaries.</p>

            <button disabled className="w-full mt-2 bg-gray-600 text-gray-400 font-semibold py-2 px-4 rounded-md cursor-not-allowed opacity-70">
              Notification Sound Preferences (Coming Soon)
            </button>
          </div>
        </section>

        {/* Appearance Settings */}
        <section className="mb-10 p-6 bg-gray-750 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-indigo-300 mb-6">Appearance</h2>
          <div className="space-y-3">
            <ToggleSwitch
              label="Dark Mode"
              enabled={darkMode}
              onChange={setDarkMode}
              disabled // Placeholder - theme is usually global
            />
             <button disabled className="w-full mt-2 bg-gray-600 text-gray-400 font-semibold py-2 px-4 rounded-md cursor-not-allowed opacity-70">
              Adjust Font Size (Coming Soon)
            </button>
          </div>
        </section>

        {/* Privacy & Data Settings */}
        <section className="mb-10 p-6 bg-gray-750 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-indigo-300 mb-6">Privacy & Data</h2>
          <div className="space-y-3">
            <button disabled className="w-full bg-gray-600 text-gray-400 font-semibold py-2 px-4 rounded-md cursor-not-allowed opacity-70">
              Who can send me Direct Messages? (Coming Soon)
            </button>
            <button disabled className="w-full bg-gray-600 text-gray-400 font-semibold py-2 px-4 rounded-md cursor-not-allowed opacity-70">
              Export My Data (Coming Soon)
            </button>
          </div>
        </section>

        {/* About/Help Section */}
        <section className="p-6 bg-gray-750 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-indigo-300 mb-6">About & Help</h2>
          <div className="space-y-3">
            <button disabled className="w-full bg-gray-600 text-gray-400 font-semibold py-2 px-4 rounded-md cursor-not-allowed opacity-70">
              Help / FAQ (Coming Soon)
            </button>
            <button disabled className="w-full bg-gray-600 text-gray-400 font-semibold py-2 px-4 rounded-md cursor-not-allowed opacity-70">
              Report a Bug (Coming Soon)
            </button>
            <p className="text-sm text-gray-500 text-center pt-2">App Version: 0.1.0 (Alpha)</p>
          </div>
        </section>

      </div>
    </div>
  );
}