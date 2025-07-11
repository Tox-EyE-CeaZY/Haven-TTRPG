// src/app/my-games/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Define interfaces matching your backend schemas (can be shared/imported from a types file later)
interface UserSchema {
  id: number;
  username: string;
  nickname?: string | null;
}

interface GameDetails {
  id: number;
  name: string;
  description?: string | null;
  max_players?: number | null;
  master_id: number;
  master: UserSchema; // Should be the current user for these games
  players: UserSchema[];
}

export default function MyGamesPage() {
  const [myGames, setMyGames] = useState<GameDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login?message=Please login to view your games');
      return;
    }

    const fetchMyGames = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/my-games`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 401) { // Unauthorized
            localStorage.removeItem('accessToken');
            router.push('/login?message=Session expired. Please login again.');
            return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `Failed to fetch your games: ${response.statusText}`);
        }
        const data: GameDetails[] = await response.json();
        setMyGames(data);
      } catch (err: any) {
        console.error('Fetch my games error:', err);
        setError(err.message || 'An unexpected error occurred while fetching your games.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyGames();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 md:p-8">
      <div className="container mx-auto">
        <div className="mb-6">
            <Link href="/" className="text-indigo-400 hover:text-indigo-200 transition-colors">
                &larr; Back to Homepage
            </Link>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-400 mb-4 sm:mb-0">
            My Games (GM)
          </h1>
          <Link
            href="/games/create"
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-150"
          >
            Create New Game
          </Link>
        </div>

        {loading && <p className="text-center text-xl text-gray-400">Loading your created games...</p>}
        {error && <p className="text-center text-xl text-red-400 bg-red-900 p-3 rounded-md">{error}</p>}

        {!loading && !error && myGames.length === 0 && (
          <p className="text-center text-xl text-gray-500">
            You haven't created any games yet. <Link href="/games/create" className="text-indigo-400 hover:underline">Start your first adventure now!</Link>
          </p>
        )}

        {!loading && !error && myGames.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myGames.map((game) => (
              <div key={game.id} className="bg-gray-700 p-6 rounded-lg shadow-xl hover:shadow-indigo-500/30 transition-shadow duration-300 flex flex-col">
                <h2 className="text-2xl font-semibold text-indigo-300 mb-2">{game.name}</h2>
                <p className="text-sm text-gray-400 mb-3">
                  Players: {game.players.length}
                  {game.max_players ? ` / ${game.max_players}` : ''}
                </p>
                {game.description && (
                  <p className="text-gray-300 mb-4 text-sm leading-relaxed flex-grow h-20 overflow-hidden text-ellipsis">
                    {game.description}
                  </p>
                )}
                <button
                  onClick={() => router.push(`/games/${game.id}`)}
                  className="w-full mt-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150"
                >
                  View & Manage
                </button>
                {/* Add Edit/Delete buttons here later */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
