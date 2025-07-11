// src/app/view/[userId]/[characterId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation'; // Use useParams

interface RoleplayCharacterViewData {
  id: number;
  user_id: number;
  name: string;
  nickname?: string | null;
  description?: string | null;
  profile_photo_filename?: string | null;
  reference_photo_filename?: string | null;
  design?: string | null;
  abilities?: string | null;
  lore?: string | null;
  birthday?: string | null;
  interests?: string | null;
  disinterests?: string | null;
  home_world?: string | null;
  universe?: string | null;
  time_period?: string | null;
  main_weapon?: string | null;
  armor_attire?: string | null;
  key_items?: string | null;
  general_inventory?: string | null;
  timestamp_created: string;
  timestamp_updated?: string | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper to construct image URLs
const getCharacterImageUrl = (userId: string | number, filename: string | null | undefined): string | null => {
  if (!filename) return null;
  // Ensure API_BASE_URL is defined and accessible here
  return `${API_BASE_URL}/api/characters/images/${userId}/${filename}`;
};

export default function CharacterViewPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const characterIdFromUrl = params.characterId as string; // Renamed for clarity

  const [character, setCharacter] = useState<RoleplayCharacterViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      // Allow viewing if not logged in, but owner features won't be available
      // router.push(`/login?message=Please login to view characters&redirect=/view/${userId}/${characterIdFromUrl}`);
      // return;
      setCurrentUserId(null); // Explicitly set to null if no token
    } else {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.user_id);
      } catch (e) {
        console.error("Token decode error:", e);
        // Don't push to login, allow anonymous view. Clear potentially bad token.
        localStorage.removeItem('accessToken');
        setCurrentUserId(null);
      }
    }

    if (userId && characterIdFromUrl) { // userId is owner's ID from URL
      const fetchCharacter = async () => {
        setLoading(true);
        setError(null);
        try {
          // NEW: Call a hypothetical public endpoint.
          // The backend needs to serve this endpoint without requiring the viewer to be the owner.
          // It uses `userId` (owner's ID) and `characterIdFromUrl` from the path.
          const response = await fetch(`${API_BASE_URL}/api/public/characters/${userId}/${characterIdFromUrl}`, {
            // No Authorization header for public GET, or backend handles optional auth
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}, // Send token if available, backend might use it for rate limiting or future features
          });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to fetch character data.');
          }
          const data: RoleplayCharacterViewData = await response.json();
          setCharacter(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchCharacter();
    }
  }, [characterIdFromUrl, router, userId]); // Depends on owner's userId and characterIdFromUrl

  // Check if the viewing user is the owner, based on current API structure
  useEffect(() => {
    if (character && currentUserId) {
      if (character.user_id === currentUserId) {
        setIsOwner(true);
      } else {
        setIsOwner(false);
        // Optional: If you want to prevent non-owners from seeing anything, you could set an error here.
        // setError("You are not authorized to view this character in full detail or it doesn't belong to you.");
        // setCharacter(null); // Clear character data if not authorized
      }
    }
  }, [character, currentUserId]);


  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><p>Loading character...</p></div>;
  if (error) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 text-center"><p className="text-red-400 bg-red-800 p-4 rounded-md">{error}</p><Link href="/" className="mt-4 text-indigo-400 hover:underline">Go Home</Link></div>;
  if (!character) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><p>Character not found.</p></div>;

  const profileImageUrl = getCharacterImageUrl(character.user_id, character.profile_photo_filename);
  const referenceImageUrl = getCharacterImageUrl(character.user_id, character.reference_photo_filename);

  const renderDetail = (label: string, value: string | number | null | undefined) => {
    if (!value && typeof value !== 'number') return null;
    return (
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">{label}</h3>
        <p className="text-gray-300 whitespace-pre-wrap">{value}</p>
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col md:flex-row">
        {/* Sidebar for Images */}
        <aside className="w-full md:w-1/3 lg:w-1/4 bg-gray-800 p-6 space-y-6 overflow-y-auto">
          <h2 className="text-2xl font-bold text-teal-400 mb-4">Gallery</h2>
          {profileImageUrl && (
            <div className="cursor-pointer" onClick={() => setLightboxImage(profileImageUrl)}>
              <img src={profileImageUrl} alt={`${character.name} - Profile`} className="w-full rounded-lg shadow-lg object-cover aspect-square hover:opacity-80 transition-opacity" />
              <p className="text-center text-sm text-gray-400 mt-2">Profile Photo</p>
            </div>
          )}
          {referenceImageUrl && (
            <div className="cursor-pointer" onClick={() => setLightboxImage(referenceImageUrl)}>
              <img src={referenceImageUrl} alt={`${character.name} - Reference`} className="w-full rounded-lg shadow-lg object-cover aspect-square hover:opacity-80 transition-opacity" />
              <p className="text-center text-sm text-gray-400 mt-2">Reference Art</p>
            </div>
          )}
          {(!profileImageUrl && !referenceImageUrl) && <p className="text-gray-500">No images uploaded.</p>}
           <Link href={`/create/character/roleplay`} className="block mt-6 text-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            + Create New Character
          </Link>
          <Link href={`/view/${character.user_id}/${character.id}/gallery`} className="block w-full text-center bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md transition-colors">
                View Full Gallery
              </Link>
          {isOwner && character && (
            <div className="mt-auto pt-6 border-t border-gray-700 space-y-3">
              <Link href={`/edit/character/${character.id}`} className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition-colors">
                Edit Character
              </Link>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-bold text-teal-300">{character.name}</h1>
              {character.nickname && <p className="text-xl text-teal-500 italic">"{character.nickname}"</p>}
            </div>

            {renderDetail("Description", character.description)}
            {renderDetail("Design & Appearance", character.design)}
            {renderDetail("Abilities & Skills", character.abilities)}
            {renderDetail("Backstory & Lore", character.lore)}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 my-6">
              {renderDetail("Birthday / Age", character.birthday)}
              {renderDetail("Home World", character.home_world)}
              {renderDetail("Universe / Setting", character.universe)}
              {renderDetail("Time Period", character.time_period)}
            </div>

            {renderDetail("Interests", character.interests)}
            {renderDetail("Disinterests", character.disinterests)}

            {(character.main_weapon || character.armor_attire || character.key_items || character.general_inventory) && (
                <h2 className="text-2xl font-semibold text-teal-300 mt-8 mb-4 border-t border-gray-700 pt-6">Equipment</h2>
            )}
            {renderDetail("Main Weapon(s)", character.main_weapon)}
            {renderDetail("Armor / Attire", character.armor_attire)}
            {renderDetail("Key Items / Artifacts", character.key_items)}
            {renderDetail("General Inventory", character.general_inventory)}

            <div className="mt-10 text-center">
              <Link href="/create" className="text-indigo-400 hover:text-indigo-200 transition-colors text-sm">&larr; Back to Create Options</Link>
            </div>
          </div>
        </main>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img 
            src={lightboxImage} 
            alt="Enlarged view" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image itself
          />
        </div>
      )}
    </>
  );
}