// src/app/create/character/roleplay/page.tsx
'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface RoleplayCharacterForm {
  name: string;
  nickname: string;
  description: string;
  profilePhoto: File | null;
  referencePhoto: File | null;
  design: string;
  abilities: string;
  lore: string;
  birthday: string;
  interests: string;
  disinterests: string;
  home_world: string; // snake_case
  universe: string;
  time_period: string; // snake_case
  main_weapon: string; // snake_case
  armor_attire: string; // snake_case
  key_items: string; // snake_case
  general_inventory: string; // snake_case
}

// Interface for the API response when creating a character
interface RoleplayCharacterResponse extends RoleplayCharacterForm {
  id: number;
  user_id: number;
  timestamp_created: string;
  timestamp_updated?: string | null;
}
export default function CreateRoleplayCharacterPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [formData, setFormData] = useState<RoleplayCharacterForm>({
    name: '',
    nickname: '',
    description: '',
    profilePhoto: null,
    referencePhoto: null,
    design: '',
    abilities: '',
    lore: '',
    birthday: '',
    interests: '',
    disinterests: '',
    home_world: '', // snake_case
    universe: '',
    time_period: '', // snake_case
    main_weapon: '', // snake_case
    armor_attire: '', // snake_case
    key_items: '', // snake_case
    general_inventory: '', // snake_case
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Basic auth check, redirect if not logged in
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login?message=Please login to create a character');
      return;
    }
    // Decode token to get user_id for redirect
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.user_id) {
        setCurrentUserId(payload.user_id);
      } else {
        throw new Error("Token payload invalid, missing user_id");
      }
    } catch (e) {
      console.error("Auth error on create character page:", e);
      localStorage.removeItem('accessToken');
      router.push('/login?message=Session invalid. Please login again.');
    }
  }, [router]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setError('Authentication token not found. Please login again.');
      setIsSubmitting(false);
      router.push('/login?message=Please login to create a character');
      return;
    }

    // Prepare text data for character creation
    const characterTextData: Omit<RoleplayCharacterForm, 'profilePhoto' | 'referencePhoto'> = { ...formData };
    delete (characterTextData as any).profilePhoto; // Remove file objects for the initial creation
    delete (characterTextData as any).referencePhoto;

    let createdCharacterId: number | null = null;

    try {
      // 1. Create character with text data
      const createResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/characters/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(characterTextData),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.detail || 'Failed to create character.');
      }

      const createdCharacter: RoleplayCharacterResponse = await createResponse.json();
      createdCharacterId = createdCharacter.id;
      setSuccessMessage(`Character "${createdCharacter.name}" created successfully!`);

      // 2. Upload profile photo if present
      if (formData.profilePhoto && createdCharacterId) {
        const photoFormData = new FormData();
        photoFormData.append('file', formData.profilePhoto);
        const profilePhotoResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/characters/${createdCharacterId}/profile-photo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: photoFormData,
        });
        if (!profilePhotoResponse.ok) console.error('Failed to upload profile photo.'); // Non-critical error for now
      }

      // 3. Upload reference photo if present
      if (formData.referencePhoto && createdCharacterId) {
        const photoFormData = new FormData();
        photoFormData.append('file', formData.referencePhoto);
        const refPhotoResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/characters/${createdCharacterId}/reference-photo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: photoFormData,
        });
        if (!refPhotoResponse.ok) console.error('Failed to upload reference photo.'); // Non-critical error for now
      }
      
      if (createdCharacterId && currentUserId) {
        // Redirect to the new character viewer page
        setTimeout(() => router.push(`/view/${currentUserId}/${createdCharacterId}`), 1500);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-gray-400 text-white";
  const textareaClass = `${inputClass} min-h-[100px]`;
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 md:p-8">
      <div className="bg-gray-800 p-6 md:p-10 rounded-xl shadow-2xl w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-teal-400">Roleplay Character Forge</h1>
          <p className="text-md text-gray-400 mt-2">
            Craft the intricate details of your character for immersive text-based adventures.
          </p>
        </div>

        {error && <p className="mb-4 text-red-400 text-sm text-center bg-red-900 p-3 rounded-md">{error}</p>}
        {successMessage && <p className="mb-4 text-green-400 text-sm text-center bg-green-900 p-3 rounded-md">{successMessage}</p>}


        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Core Identity */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Core Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label htmlFor="name" className={labelClass}>Full Name</label><input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className={inputClass} placeholder="e.g., Seraphina Moonwhisper" required /></div>
              <div><label htmlFor="nickname" className={labelClass}>Nickname(s)</label><input type="text" id="nickname" name="nickname" value={formData.nickname} onChange={handleInputChange} className={inputClass} placeholder="e.g., Sera, Moonie" /></div>
            </div>
            <div className="mt-6"><label htmlFor="description" className={labelClass}>Brief Description / Tagline</label><textarea id="description" name="description" value={formData.description} onChange={handleInputChange} className={textareaClass} placeholder="A mysterious sorceress with a hidden past..." /></div>
            <div className="mt-6"><label htmlFor="birthday" className={labelClass}>Birthday / Age</label><input type="text" id="birthday" name="birthday" value={formData.birthday} onChange={handleInputChange} className={inputClass} placeholder="e.g., Spring Equinox, 27 cycles" /></div>
          </section>

          {/* Section 2: Visuals */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Visuals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="profilePhoto" className={labelClass}>Profile Photo (Avatar)</label>
                <input type="file" id="profilePhoto" name="profilePhoto" onChange={handleFileChange} className={`${inputClass} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100`} accept="image/*" />
              </div>
              <div>
                <label htmlFor="referencePhoto" className={labelClass}>Main Reference Photo</label>
                <input type="file" id="referencePhoto" name="referencePhoto" onChange={handleFileChange} className={`${inputClass} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100`} accept="image/*" />
              </div>
            </div>
            <div className="mt-6"><label htmlFor="design" className={labelClass}>Detailed Design / Appearance</label><textarea id="design" name="design" value={formData.design} onChange={handleInputChange} className={textareaClass} placeholder="Describe their physical features, clothing, distinguishing marks, etc." /></div>
          </section>

          {/* Section 3: Traits & Background */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Traits & Background</h2>
            <div><label htmlFor="abilities" className={labelClass}>Abilities / Skills</label><textarea id="abilities" name="abilities" value={formData.abilities} onChange={handleInputChange} className={textareaClass} placeholder="List their notable talents, magical prowess, combat skills, etc." /></div>
            <div className="mt-6"><label htmlFor="interests" className={labelClass}>Interests / Likes</label><textarea id="interests" name="interests" value={formData.interests} onChange={handleInputChange} className={textareaClass} placeholder="What do they enjoy? Hobbies, passions, etc." /></div>
            <div className="mt-6"><label htmlFor="disinterests" className={labelClass}>Disinterests / Dislikes</label><textarea id="disinterests" name="disinterests" value={formData.disinterests} onChange={handleInputChange} className={textareaClass} placeholder="What do they avoid or detest?" /></div>
          </section>

          {/* Section 4: Lore & Setting */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Lore & Setting</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label htmlFor="home_world" className={labelClass}>Home World</label><input type="text" id="home_world" name="home_world" value={formData.home_world} onChange={handleInputChange} className={inputClass} placeholder="e.g., Eldoria, Terra Nova" /></div>
              <div><label htmlFor="universe" className={labelClass}>Universe / Setting</label><input type="text" id="universe" name="universe" value={formData.universe} onChange={handleInputChange} className={inputClass} placeholder="e.g., The Azure Expanse" /></div>
              <div><label htmlFor="time_period" className={labelClass}>Time Period</label><input type="text" id="time_period" name="time_period" value={formData.time_period} onChange={handleInputChange} className={inputClass} placeholder="e.g., Age of Dragons, 3042 AD" /></div>
            </div>
            <div className="mt-6"><label htmlFor="lore" className={labelClass}>Backstory / Lore</label><textarea id="lore" name="lore" value={formData.lore} onChange={handleInputChange} className={textareaClass} placeholder="Detail their history, significant events, relationships, and personal lore." /></div>
          </section>

          {/* Section 5: Equipment */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Equipment & Possessions</h2>
            <div><label htmlFor="main_weapon" className={labelClass}>Main Weapon(s)</label><input type="text" id="main_weapon" name="main_weapon" value={formData.main_weapon} onChange={handleInputChange} className={inputClass} placeholder="e.g., Ancestral Longsword, Staff of Whispers" /></div>
            <div className="mt-6"><label htmlFor="armor_attire" className={labelClass}>Armor / Attire</label><textarea id="armor_attire" name="armor_attire" value={formData.armor_attire} onChange={handleInputChange} className={textareaClass} placeholder="Describe their typical combat gear or everyday clothing." /></div>
            <div className="mt-6"><label htmlFor="key_items" className={labelClass}>Key Items / Artifacts</label><textarea id="key_items" name="key_items" value={formData.key_items} onChange={handleInputChange} className={textareaClass} placeholder="List important unique items they possess." /></div>
            <div className="mt-6"><label htmlFor="general_inventory" className={labelClass}>General Inventory / Pouch</label><textarea id="general_inventory" name="general_inventory" value={formData.general_inventory} onChange={handleInputChange} className={textareaClass} placeholder="Common items, tools, currency, etc." /></div>
          </section>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-6 border-t border-gray-700">
            <Link href="/create" className="text-gray-400 hover:text-gray-200 transition-colors text-sm order-2 sm:order-1">
              &larr; Back to Create Options
            </Link>
            <button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition duration-150 order-1 sm:order-2 w-full sm:w-auto disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Forging...' : 'Forge Character'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}