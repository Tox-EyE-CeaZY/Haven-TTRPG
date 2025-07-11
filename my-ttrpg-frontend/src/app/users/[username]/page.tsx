// src/app/users/[username]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // For the back button functionality

interface UserProfile {
  id: number;
  username: string;
  nickname?: string | null;
  // email: string; // Removed for public profile view, backend should not send this for other users
  bio?: string | null;
  avatar_url?: string | null;
  social_links?: { [key: string]: string } | null;
}

const API_LINK_PREFIX = 'link_';
const API_CONTENT_PREFIX = 'content_';

// Helper function to construct full avatar URL (can be moved to a shared util)
const getFullAvatarUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:')) {
    return url;
  }
  return `${process.env.NEXT_PUBLIC_API_URL || ''}${url}`;
};

export default function UserProfilePage({ params }: { params: { username: string } }) {
  const { username } = params;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (username) {
      // If only logged-in users can view profiles, check for token first.
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push(`/login?message=Please login to view user profiles.&redirect=/users/${encodeURIComponent(username)}`);
        return;
      }

      const fetchUserProfile = async () => {
        setLoading(true);
        setError(null);
        try {
          // Corrected: Use the new public profile endpoint
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile/${encodeURIComponent(username)}`);

          // No explicit Authorization header is sent here, which is correct for a public backend endpoint.
          // If the backend *still* gives 401, the issue is likely on the backend/server configuration
          // or the browser is sending an old/invalid token automatically.

          if (!response.ok) {
            if (response.status === 404) {
              throw new Error(`User "${username}" not found.`);
            }
            let errData;
            try {
              errData = await response.json();
            } catch (e) {
              throw new Error(`Failed to fetch user profile. Status: ${response.status}`);
            }
            throw new Error(errData.detail || 'Failed to fetch user profile.');
          }
          const data: UserProfile = await response.json();
          setProfile(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchUserProfile();
    }
  }, [username, router]);

  if (loading) {
    return <div className="min-h-screen bg-gray-800 text-white flex items-center justify-center"><p>Loading profile for {username}...</p></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-800 text-white flex flex-col items-center justify-center">
        <p className="text-xl text-red-400 bg-red-900 p-3 rounded-md">{error}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md"
        >
          &larr; Go Back
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
        <div className="min-h-screen bg-gray-800 text-white flex flex-col items-center justify-center">
            <p className="text-xl">Profile for {username} could not be loaded.</p>
            <button
              onClick={() => router.back()}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md"
            >
              &larr; Go Back
            </button>
        </div>
    );
  }

  const displayAvatarSrc = getFullAvatarUrl(profile.avatar_url);

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 md:p-8 flex justify-center">
      <div className="bg-gray-700 p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-2xl">
        <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="text-indigo-400 hover:text-indigo-200 transition-colors"
            >
              &larr; Go Back
            </button>
        </div>

        <div className="flex flex-col items-center mb-6">
          {displayAvatarSrc ? (
            <img
              src={displayAvatarSrc}
              alt={`${profile.username}'s avatar`}
              className="w-32 h-32 rounded-full object-cover border-4 border-indigo-500 mb-4"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-600 flex items-center justify-center text-gray-400 text-4xl mb-4 border-4 border-indigo-500">
              {profile?.username?.substring(0, 2).toUpperCase() || '??'}
            </div>
          )}
          <h1 className="text-3xl font-bold text-indigo-400">
            {profile.nickname || profile.username}
          </h1>
          {profile.nickname && profile.nickname.toLowerCase() !== profile.username.toLowerCase() && (
            <p className="text-lg text-gray-300 mt-1">(Username: {profile.username})</p>
          )}
        </div>

        {profile.bio && (
          <div className="mb-6 p-4 bg-gray-600 rounded-lg">
            <h2 className="text-xl font-semibold text-indigo-200 mb-2">Bio</h2>
            <p className="text-gray-300 whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {profile.social_links && Object.keys(profile.social_links).length > 0 ? (
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-indigo-200 mb-3">Also -</h3>
            <div className="space-y-2 bg-gray-600 p-4 rounded-md">
              {Object.entries(profile.social_links).map(([key, value]) => {
                if (key.startsWith(API_LINK_PREFIX) && value) {
                  return <div key={key}><span className="font-semibold text-gray-300">{key.substring(API_LINK_PREFIX.length)}: </span><a href={value} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline break-all">{value}</a></div>;
                } else if (key.startsWith(API_CONTENT_PREFIX) && value) {
                  return <div key={key} className="mt-2 pt-2 border-t border-gray-500 first:border-t-0 first:mt-0 first:pt-0"><h4 className="font-semibold text-gray-300">{key.substring(API_CONTENT_PREFIX.length)}:</h4><p className="text-gray-200 whitespace-pre-wrap">{value}</p></div>;
                } else if (value) { // Fallback for old format (assume link)
                    return <div key={key}><span className="font-semibold text-gray-300">{key}: </span><a href={value} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline break-all">{value}</a></div>;
                }
                return null;
              })}
            </div>
          </div>
        ) : null}

        {(!profile.bio || profile.bio.trim() === '') && (!profile.social_links || Object.keys(profile.social_links).length === 0) && (
          <p className="text-gray-400 text-center mt-6">This user hasn't added much to their profile yet.</p>
        )}
      </div>
    </div>
  );
}