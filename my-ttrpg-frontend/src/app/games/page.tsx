// src/app/games/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Define interfaces matching your backend schemas
interface UserSchema {
  id: number;
  username: string;
  // email: string; // Add if you plan to display it and it's in your User schema
}

interface GameDetails {
  id: number;
  name: string;
  description?: string | null;
  max_players?: number | null;
  master_id: number;
  master: UserSchema;
  players: UserSchema[];
}

interface CurrentUser {
  id: number;
  username: string;
}

type FilterMode = 'all' | 'joined';

export default function GamesListPage() {
  const [games, setGames] = useState<GameDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const router = useRouter();

  useEffect(() => {
    // Fetch current user details to determine auth status
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.sub && payload.user_id) {
          setCurrentUser({ id: payload.user_id, username: payload.sub });
        } else {
          // Fallback or clear if token is malformed for our needs
          setCurrentUser(null);
        }
      } catch (e) {
        console.error("Failed to decode token for current user:", e);
        setCurrentUser(null);
        localStorage.removeItem('accessToken'); // Clear potentially bad token
      }
    } else {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    const fetchGamesData = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      let allGamesUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/games/`;
      let urlToFetch = allGamesUrl; // Default to all games URL
      const headers: HeadersInit = {};

      if (filterMode === 'joined' && currentUser) {
        if (!token || !currentUser) {
          setError("Please login to see the games you've joined.");
          setGames([]); // Clear games if not authorized for this view
          setLoading(false);
          // Optionally, redirect or switch filterMode back to 'all'
          // router.push('/login?message=Please login to view your joined games');
          // setFilterMode('all'); // Fallback to all games view
          return;
        }
        urlToFetch = `${process.env.NEXT_PUBLIC_API_URL}/api/users/me/joined-games`;
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch(urlToFetch, { headers });

        if (filterMode === 'joined' && response.status === 401) {
          localStorage.removeItem('accessToken');
          setCurrentUser(null);
          setFilterMode('all'); // Revert to all games on auth error
          router.push('/login?message=Session expired. Please login to see your joined games.');
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `Failed to fetch games: ${response.statusText}`);
        }
        const data: GameDetails[] = await response.json();
        setGames(data);
      } catch (err: any) {
        console.error('Fetch games error:', err);
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchGamesData();
  }, [filterMode, currentUser, router]); // Rerun if filterMode or currentUser changes (e.g., after login)

  const getButtonClass = (mode: FilterMode) => {
    return filterMode === mode
      ? "bg-indigo-600 text-white"
      : "bg-gray-600 hover:bg-gray-500 text-gray-300";
  };

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 md:p-8">
      <div className="container mx-auto">
        <div className="mb-6"> {/* Consistent margin for back button */}
            <Link href="/" className="text-indigo-400 hover:text-indigo-200 transition-colors">
                &larr; Back to Homepage
            </Link>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-400 mb-4 sm:mb-0">
            Available Games
          </h1>
          {currentUser && (
            <Link
              href="/games/create"
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-150"
            >
              Create New Game
            </Link>
          )}
        </div>

        <div className="mb-6 flex flex-wrap justify-center sm:justify-start items-center gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`py-2 px-4 rounded-md font-semibold transition-colors ${getButtonClass('all')}`}
          >
            All Games
          </button>
          {currentUser && ( // Only show "My Joined Games" if user is logged in
            <button
              onClick={() => setFilterMode('joined')}
              className={`py-2 px-4 rounded-md font-semibold transition-colors ${getButtonClass('joined')}`}
            >
              My Joined Games
            </button>
          )}
          {/* Placeholder for Base Game Filter */}
          {currentUser && (
            <div className="py-2 px-4 rounded-md font-semibold bg-gray-500 text-gray-400 cursor-not-allowed" title="Coming soon!">
              Base Game Filter (e.g., D&D)
            </div>
          )}
        </div>

        {loading && <p className="text-center text-xl text-gray-400">Loading adventures...</p>}
        {error && <p className="text-center text-xl text-red-400 bg-red-900 p-3 rounded-md">{error}</p>}

        {!loading && !error && games.length === 0 && (
          filterMode === 'all' ? (
            <p className="text-center text-xl text-gray-500">
              No games available at the moment. {currentUser && <Link href="/games/create" className="text-indigo-400 hover:underline">Why not create one?</Link>}
            </p>
          ) : (
            <p className="text-center text-xl text-gray-500">
              You haven't joined any games yet. <Link href="/games" onClick={() => setFilterMode('all')} className="text-indigo-400 hover:underline">Browse all games</Link> to find one!
            </p>
          )
        )}

        {!loading && !error && games.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <div key={game.id} className="bg-gray-700 p-6 rounded-lg shadow-xl hover:shadow-indigo-500/30 transition-shadow duration-300">
                <h2 className="text-2xl font-semibold text-indigo-300 mb-2">{game.name}</h2>
                <p className="text-sm text-gray-400 mb-1">
                  Game Master: <span className="font-medium text-gray-300">{game.master.username}</span>
                </p>
                <p className="text-sm text-gray-400 mb-3">
                  Players: {game.players.length}
                  {game.max_players ? ` / ${game.max_players}` : ''}
                </p>
                {game.description && (
                  <p className="text-gray-300 mb-4 text-sm leading-relaxed h-20 overflow-hidden text-ellipsis">
                    {game.description}
                  </p>
                )}
                {/* We'll make this a proper link to the game detail page later */}
                <button
                  onClick={() => router.push(`/games/${game.id}`)} // Placeholder for navigation
                  className="w-full mt-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
