// src/app/games/create/page.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface GameDetails {
  id: number;
  name: string;
  description?: string | null;
  max_players?: number | null;
  master_id: number;
  // Add other fields if your GameDetails schema has them
}

export default function CreateGamePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<string>(''); // Store as string for input field
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login?message=Please login to create a game');
    }
    // Add token validation/decoding here if needed for more robust protection
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError('Authentication token not found. Please login again.');
      setLoading(false);
      router.push('/login');
      return;
    }

    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/games/`;

    const gameData: { name: string; description?: string; max_players?: number } = {
      name,
    };
    if (description) gameData.description = description;
    if (maxPlayers) {
      const numMaxPlayers = parseInt(maxPlayers, 10);
      if (!isNaN(numMaxPlayers) && numMaxPlayers > 0) {
        gameData.max_players = numMaxPlayers;
      } else if (maxPlayers.trim() !== '') {
        setError('Max players must be a positive number.');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(gameData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        setError(responseData.detail || 'Failed to create game. Please try again.');
        setLoading(false);
        return;
      }

      const createdGame = responseData as GameDetails;
      setSuccessMessage(`Game "${createdGame.name}" created successfully! Redirecting...`);
      setTimeout(() => {
        router.push(`/games/${createdGame.id}`); // Redirect to the new game's detail page
      }, 2500);

    } catch (err) {
      console.error('Create game API error:', err);
      setError('An error occurred while creating the game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-800 text-white p-4">
      <div className="bg-gray-700 p-8 rounded-lg shadow-xl w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-6 text-center text-indigo-400">Create a New Game</h1>
        {error && <p className="mb-4 text-red-400 text-sm text-center bg-red-900 p-2 rounded">{error}</p>}
        {successMessage && <p className="mb-4 text-green-400 text-sm text-center bg-green-900 p-2 rounded">{successMessage}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Game Name</label>
            <input
              type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
              required disabled={loading} placeholder="The Grand Adventure"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
            <textarea
              id="description" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
              disabled={loading} placeholder="A brief summary of your game's theme or story"
            />
          </div>
          <div>
            <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-300 mb-1">Max Players (Optional)</label>
            <input
              type="number" id="maxPlayers" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)}
              min="1"
              className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400"
              disabled={loading} placeholder="e.g., 5"
            />
          </div>
          <button type="submit" disabled={loading || !!successMessage}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 disabled:opacity-60 transition duration-150 ease-in-out"
          >
            {loading ? 'Summoning Game World...' : 'Create Game'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm flex justify-center space-x-4">
          <Link href="/games" className="text-indigo-400 hover:text-indigo-300">
            &larr; Back to Games List
          </Link>
          <Link href="/" className="text-gray-400 hover:text-gray-300">
            Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
