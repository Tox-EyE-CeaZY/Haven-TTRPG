// src/app/register/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/users/register`; // Your FastAPI backend URL

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = 'Registration failed. Please try again.';
        if (data.detail) {
          if (Array.isArray(data.detail)) {
            // FastAPI validation errors are an array of objects
            errorMessage = data.detail.map((err: { loc: string[], msg: string, type: string }) => `${err.loc.join('.')} - ${err.msg}`).join('; ');
          } else if (typeof data.detail === 'string') {
            // Simple string error
            errorMessage = data.detail;
          }
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      setSuccessMessage('Registration successful! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2000); // Wait 2 seconds before redirecting

    } catch (err) {
      console.error('Registration API error:', err);
      setError('An error occurred during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-800 text-white p-4">
      <div className="bg-gray-700 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-indigo-400">Join the Adventure</h1>
        {error && <p className="mb-4 text-red-400 text-sm text-center bg-red-900 p-2 rounded">{error}</p>}
        {successMessage && <p className="mb-4 text-green-400 text-sm text-center bg-green-900 p-2 rounded">{successMessage}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
              required disabled={loading} placeholder="Choose your adventurer name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
              required disabled={loading} placeholder="Your contact scroll (email)"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
              required disabled={loading} placeholder="Create a strong password"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-60 transition duration-150 ease-in-out"
          >
            {loading ? 'Forging Account...' : 'Register'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account? <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">Login here</Link>
        </p>
      </div>
    </div>
  );
}
