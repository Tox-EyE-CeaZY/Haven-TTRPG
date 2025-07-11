// src/app/create/page.tsx
'use client';
import { useState } from 'react'; // Import useState
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreatePage() {
  const router = useRouter();

  // State to manage the visibility of character creation sub-options
  const [showCharacterOptions, setShowCharacterOptions] = useState(false);

  useEffect(() => {
    // Basic auth check, redirect if not logged in
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login?message=Please login to access the creation page');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-800 text-white flex flex-col items-center justify-center p-6">
      <div className="bg-gray-700 p-10 rounded-xl shadow-2xl w-full max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-6 text-sky-400">Create Something New</h1>
        <p className="text-lg text-gray-400 mb-8">
          This is where you'll be able to create new worlds, characters, lore, and documents!
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* New Character Button and Sub-options */}
          <div className="sm:col-span-2 flex flex-col items-center">
            <button 
              onClick={() => setShowCharacterOptions(!showCharacterOptions)}
              className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md transition duration-150 text-lg mb-2"
            >
              New Character {showCharacterOptions ? '▲' : '▼'}
            </button>
            {showCharacterOptions && (
              <div className="flex flex-col sm:flex-row gap-4 mt-2 w-full sm:w-auto justify-center">
                <Link href="/create/character/roleplay" className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-5 rounded-lg shadow-sm transition duration-150 text-base w-full sm:w-auto text-center">
                  Roleplay
                </Link>
                <button className="bg-gray-500 hover:bg-gray-400 text-white font-semibold py-3 px-5 rounded-lg shadow-sm transition duration-150 text-base opacity-70 cursor-not-allowed w-full sm:w-auto" title="Coming Soon">
                  TTRPG
                </button>
              </div>
            )}
          </div>

          <button className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md transition duration-150 text-lg">
            New World
          </button>
          <button className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md transition duration-150 text-lg">
            New Lore
          </button>
          <button className="bg-slate-500 hover:bg-slate-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md transition duration-150 text-lg">
            New Document
          </button>
        </div>
        <Link href="/" className="text-indigo-400 hover:text-indigo-200 transition-colors text-sm">&larr; Back to Homepage</Link>
      </div>
    </div>
  );
}