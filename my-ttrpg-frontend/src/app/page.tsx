// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NotificationBell } from '@/components/notifications/NotificationBell'; // Import NotificationBell

// A simple (and very basic) way to decode a JWT to get the username
// In a real app, you might want a more robust JWT decoding library or get user info from an API endpoint
interface DecodedToken {
  sub?: string; // 'sub' usually holds the username or user ID
  nickname?: string | null; // Nickname from the token
  exp?: number;
  // Add other fields if your token has them
}

function decodeJwt(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload) as DecodedToken;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // New state for auth loading
  const [displayName, setDisplayName] = useState<string | null>(null); // For nickname or username fallback
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const decodedToken = decodeJwt(token);
      if (decodedToken && decodedToken.exp && decodedToken.exp * 1000 > Date.now()) {
        setIsAuthenticated(true);
        setUsername(decodedToken.sub || 'User');
        setDisplayName(decodedToken.nickname || decodedToken.sub || 'Adventurer'); // Use nickname, fallback to username
      } else {
        // Token exists but is invalid or expired
        localStorage.removeItem('accessToken');
        setIsAuthenticated(false);
        setUsername(null);
        setDisplayName(null);
      }
    } else {
      setIsAuthenticated(false);
      setUsername(null);
      setDisplayName(null);
    }
    setAuthLoading(false); // Finished checking auth
  }, []); // Empty dependency array, runs once on mount

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    window.dispatchEvent(new Event('authChange')); // Dispatch event for GlobalNotificationHandler
    setIsAuthenticated(false);
    setUsername(null);
    setDisplayName(null); // Clear display name on logout
    router.push('/'); // Refresh the homepage to show guest view
    // router.refresh(); // Alternative way to try and force a re-render if needed
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-800 text-white flex flex-col items-center justify-center p-6">
        <p className="text-xl">Loading user...</p>
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gray-800 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-gray-700 p-10 rounded-xl shadow-2xl w-full max-w-2xl text-center">
          <h1 className="text-5xl font-bold mb-4 text-indigo-400">Haven</h1>
          <p className="text-2xl text-gray-300 mb-8">Your TTRPG Adventure Platform</p>

          {isAuthenticated && displayName ? ( // Check displayName for greeting
            // Logged-in user view
            <div className="space-y-6">
              <p className="text-2xl text-gray-300">Greetings, {displayName}!</p>
              <p className="text-lg text-gray-400">Ready to embark on an adventure?</p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                <Link href="/games/create" className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150">
                    Create New Game
                </Link>
                <Link href="/games" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150">
                    Browse Games
                </Link>
                <Link href="/my-games" className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150">
                    My Games (GM)
                </Link>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                <Link href="/dm" className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-150 w-full sm:w-auto">
                    Direct Messages
                </Link>
                {/* Settings Cog and Logout are kept inline for now */}
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-150 w-full sm:w-auto"
                >
                  Logout
                </button>
                <Link href="/settings" className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 flex items-center justify-center w-full sm:w-auto" title="Settings">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.54.886.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.947-2.287c1.561-.379-1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.54-.886-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            </div>
          ) : (
            // Guest view
            <div className="space-y-4">
              <p className="text-xl text-gray-300">Your next great adventure awaits.</p>
              <p className="text-gray-400">Please log in or register to continue your journey.</p>
              <div className="flex justify-center gap-4 mt-6">
                <Link href="/login" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition duration-150">
                  Login
                </Link>
                <Link href="/register" className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition duration-150">
                  Register
                </Link>
              </div>
            </div>
          )}
          <p className="mt-12 text-xs text-gray-500">
            Forge your legend, one dice roll at a time.
          </p>
        </div>

        {/* Creations Section */}
        {isAuthenticated && (
          <div className="bg-gray-700 p-10 rounded-xl shadow-2xl w-full max-w-2xl text-center mt-10">
            <h2 className="text-4xl font-bold mb-6 text-teal-400">Creations</h2>
            <p className="text-lg text-gray-400 mb-8">Manage your worlds, characters, and stories.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/create" className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150">
                New
              </Link>
              <button className="bg-gray-500 hover:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 opacity-70 cursor-not-allowed" title="Coming Soon">
                Existing
              </button>
              <button className="bg-gray-500 hover:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-150 opacity-70 cursor-not-allowed" title="Coming Soon">
                Role-Play
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
