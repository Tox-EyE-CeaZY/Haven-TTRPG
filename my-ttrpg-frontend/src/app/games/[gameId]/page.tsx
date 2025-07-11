// src/app/games/[gameId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Re-using or re-defining interfaces similar to the games list page
interface UserSchema {
  id: number;
  username: string;
  // email?: string; // Optional, if you decide to include it
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

export default function GameDetailPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  const [game, setGame] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch current user details (simplified)
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Basic JWT decoding (consider a library for production)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.sub && payload.user_id) { // Assuming your token has user_id
          setCurrentUser({ id: payload.user_id, username: payload.sub });
        } else {
             // Fallback if user_id is not in token, try to fetch from /users/me
             // This part would be more robust with a dedicated auth context/hook
            const fetchMe = async () => {
                const meResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (meResponse.ok) {
                    const meData = await meResponse.json();
                    setCurrentUser({ id: meData.id, username: meData.username });
                } else {
                    // Token might be invalid or expired, clear it
                    localStorage.removeItem('accessToken');
                }
            };
            fetchMe();
        }
      } catch (e) {
        console.error("Failed to decode token or fetch user:", e);
      }
    }

    if (gameId) {
      const fetchGameDetails = async () => {
        setLoading(true);
        setError(null);
        setActionError(null);
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/${gameId}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to fetch game details: ${response.statusText}`);
          }
          const data: GameDetails = await response.json();
          setGame(data);
        } catch (err: any) {
          console.error('Fetch game details error:', err);
          setError(err.message || 'An unexpected error occurred.');
        } finally {
          setLoading(false);
        }
      };
      fetchGameDetails();
    }
  }, [gameId]);

  if (loading) {
    return <div className="min-h-screen bg-gray-800 text-white flex items-center justify-center"><p className="text-xl">Loading game details...</p></div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-800 text-white flex items-center justify-center flex-col">
        <p className="text-xl text-red-400 bg-red-900 p-3 rounded-md">{error}</p>
        <Link href="/games" className="mt-4 text-indigo-400 hover:underline">Back to Games List</Link>
      </div>;
  }

  if (!game) {
    return <div className="min-h-screen bg-gray-800 text-white flex items-center justify-center"><p className="text-xl">Game not found.</p></div>;
  }

  // Placeholder for action button logic
  const isGM = currentUser?.id === game.master_id;
  const isPlayer = game.players.some(player => player.id === currentUser?.id);
  const canJoin = !isGM && !isPlayer && (!game.max_players || game.players.length < game.max_players);

  const handleJoinGame = async () => {
    if (!currentUser) {
      setActionError("You must be logged in to join a game.");
      router.push('/login?message=Please login to join the game');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/${gameId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json', // Though not strictly needed for this POST if no body
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to join game.');
      }
      setGame(data as GameDetails); // Update game state with new details from response
    } catch (err: any) {
      console.error("Join game error:", err);
      setActionError(err.message || "An error occurred while trying to join the game.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!currentUser) {
      setActionError("You must be logged in to leave a game.");
      // Optionally redirect or just show error
      return;
    }
    setActionLoading(true);
    setActionError(null);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/${gameId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json', // Though not strictly needed for this POST if no body
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to leave game.');
      }
      setGame(data as GameDetails); // Update game state with new details from response
    } catch (err: any) {
      console.error("Leave game error:", err);
      setActionError(err.message || "An error occurred while trying to leave the game.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePlayer = async (playerToRemoveId: number) => {
    if (!currentUser || !isGM) {
      setActionError("Only the Game Master can remove players.");
      return;
    }
    if (currentUser.id === playerToRemoveId) {
      setActionError("Game Master cannot remove themselves as a player (this shouldn't happen).");
      return;
    }

    setActionLoading(true);
    setActionError(null);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/games/${gameId}/remove-player/${playerToRemoveId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to remove player.');
      }
      setGame(data as GameDetails); // Update game state
    } catch (err: any) {
      setActionError(err.message || "An error occurred while trying to remove the player.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 md:p-8">
      <div className="container mx-auto bg-gray-700 p-6 md:p-8 rounded-xl shadow-2xl">
        <div className="mb-6">
          <Link href="/games" className="text-indigo-400 hover:text-indigo-200 transition-colors">&larr; Back to Games List</Link>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-indigo-300 mb-3">{game.name}</h1>
        <p className="text-lg text-gray-400 mb-6">
          Hosted by: <span className="font-semibold text-gray-300">{game.master.username}</span>
        </p>

        {game.description && (
          <div className="mb-6 p-4 bg-gray-600 rounded-lg">
            <h2 className="text-2xl font-semibold text-indigo-200 mb-2">Description</h2>
            <p className="text-gray-300 whitespace-pre-wrap">{game.description}</p>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-indigo-200 mb-2">Players ({game.players.length}{game.max_players ? `/${game.max_players}` : ''})</h2>
          {game.players.length > 0 ? (
            <ul className="space-y-2 text-gray-300">
              {game.players.map(player => (
                <li key={player.id} className="flex justify-between items-center p-2 bg-gray-600 rounded">
                  <span>{player.username}</span>
                  {isGM && currentUser && currentUser.id !== player.id && (
                    <button
                      onClick={() => handleRemovePlayer(player.id)}
                      disabled={actionLoading}
                      className="ml-4 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold py-1 px-2 rounded disabled:opacity-50"
                    >
                      {actionLoading ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No players have joined yet.</p>
          )}
        </div>

        {actionError && (
          <p className="mb-4 text-red-400 text-sm text-center bg-red-900 p-2 rounded">
            {actionError}
          </p>
        )}

        {/* General Action Buttons */}
        <div className="mt-8 space-y-3 md:space-y-0 md:space-x-3 flex flex-col md:flex-row">
          {currentUser && canJoin && (
            <button
              onClick={handleJoinGame}
              disabled={actionLoading}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {actionLoading ? 'Joining...' : 'Join Game'}
            </button>
          )}
          {currentUser && isPlayer && (
            <button
              onClick={handleLeaveGame}
              disabled={actionLoading}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {actionLoading ? 'Leaving...' : 'Leave Game'}
            </button>
          )}
          {/* GM actions like 'Remove Player' or 'Edit Game' would go here */}
        </div>

      </div>
    </div>
  );
}
