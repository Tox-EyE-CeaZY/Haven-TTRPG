// src/app/login/page.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface AuthToken {
  access_token: string;
  token_type: string;
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      setError(message);
    }
    // Clear message from URL after displaying
    if (message && window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({...window.history.state, as: cleanUrl, url: cleanUrl }, '', cleanUrl);
    }
  }, [searchParams]);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('accessToken', token);
    window.dispatchEvent(new Event('authChange')); // Dispatch event
    router.push('/');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    console.log('Attempting to connect to API URL:', process.env.NEXT_PUBLIC_API_URL); // For debugging
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/users/token`;
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('remember_me', rememberMe.toString());

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      // Log the raw response text first
      const responseText = await response.text();
      console.log('Raw API Response Text:', responseText); // For debugging

      if (!response.ok) {
        // Try to parse error detail if response was not ok but still JSON
        try {
          const errorData = JSON.parse(responseText);
          setError(errorData.detail || 'Login failed. Please check your credentials.');
        } catch (parseError) {
          setError('Login failed and error response was not valid JSON. Status: ' + response.status);
        }
        setLoading(false);
        return;
      }

      // Now parse the successful response as JSON
      const data = JSON.parse(responseText);
      const tokenData = data as AuthToken;
      handleLoginSuccess(tokenData.access_token);

    } catch (err) {
      console.error('Login API error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col justify-center items-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-indigo-400">Login to Your Realm</h1>
        {error && <p className="bg-red-500/30 text-red-300 p-3 rounded mb-4 text-sm text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              className="mt-1 block w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="mt-1 block w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Enter your password"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 text-indigo-600 border-gray-500 rounded focus:ring-indigo-500 bg-gray-700"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                Remember me
              </label>
            </div>
            {/* Optional: Add "Forgot password?" link here */}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-800 disabled:opacity-60 transition duration-150 ease-in-out"
            >
              {loading ? 'Venturing Forth...' : 'Sign in'}
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-gray-400">
          New adventurer?{' '}
          <Link href="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
