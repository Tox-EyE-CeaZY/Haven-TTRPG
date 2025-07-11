// src/app/edit/character/[characterId]/page.tsx
'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

interface RoleplayCharacterForm {
  name: string;
  nickname: string;
  description: string;
  profilePhoto: File | null; // For new upload
  referencePhoto: File | null; // For new upload
  design: string;
  abilities: string;
  lore: string;
  birthday: string;
  interests: string;
  disinterests: string;
  home_world: string;
  universe: string;
  time_period: string;
  main_weapon: string;
  armor_attire: string;
  key_items: string;
  general_inventory: string;
}

// Interface for the API response when fetching/updating a character
interface RoleplayCharacterData extends Omit<RoleplayCharacterForm, 'profilePhoto' | 'referencePhoto'> {
  id: number;
  user_id: number;
  profile_photo_filename?: string | null;
  reference_photo_filename?: string | null;
  timestamp_created: string;
  timestamp_updated?: string | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const getCharacterImageUrl = (userId: string | number | undefined, filename: string | null | undefined): string | null => {
  if (!filename || !userId) return null;
  return `${API_BASE_URL}/api/characters/images/${userId}/${filename}`;
};

export default function EditRoleplayCharacterPage() {
  const router = useRouter();
  const params = useParams();
  const characterId = params.characterId as string;

  const [initialCharacterData, setInitialCharacterData] = useState<RoleplayCharacterData | null>(null);
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
    home_world: '',
    universe: '',
    time_period: '',
    main_weapon: '',
    armor_attire: '',
    key_items: '',
    general_inventory: '',
  });

  const [currentProfilePhotoUrl, setCurrentProfilePhotoUrl] = useState<string | null>(null);
  const [currentReferencePhotoUrl, setCurrentReferencePhotoUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push(`/login?message=Please login to edit a character&redirect=/edit/character/${characterId}`);
      return;
    }

    if (characterId) {
      const fetchCharacterData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`${API_BASE_URL}/api/characters/${characterId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch character data.');
          }
          const data: RoleplayCharacterData = await response.json();
          setInitialCharacterData(data);
          setFormData({
            name: data.name || '',
            nickname: data.nickname || '',
            description: data.description || '',
            profilePhoto: null, // Will be handled separately
            referencePhoto: null, // Will be handled separately
            design: data.design || '',
            abilities: data.abilities || '',
            lore: data.lore || '',
            birthday: data.birthday || '',
            interests: data.interests || '',
            disinterests: data.disinterests || '',
            home_world: data.home_world || '',
            universe: data.universe || '',
            time_period: data.time_period || '',
            main_weapon: data.main_weapon || '',
            armor_attire: data.armor_attire || '',
            key_items: data.key_items || '',
            general_inventory: data.general_inventory || '',
          });
          setCurrentProfilePhotoUrl(getCharacterImageUrl(data.user_id, data.profile_photo_filename));
          setCurrentReferencePhotoUrl(getCharacterImageUrl(data.user_id, data.reference_photo_filename));
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchCharacterData();
    }
  }, [characterId, router]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
      if (name === 'profilePhoto') setCurrentProfilePhotoUrl(URL.createObjectURL(files[0]));
      if (name === 'referencePhoto') setCurrentReferencePhotoUrl(URL.createObjectURL(files[0]));
    } else {
      setFormData(prev => ({ ...prev, [name]: null }));
      // Revert to original image if file is cleared
      if (name === 'profilePhoto') setCurrentProfilePhotoUrl(getCharacterImageUrl(initialCharacterData?.user_id, initialCharacterData?.profile_photo_filename));
      if (name === 'referencePhoto') setCurrentReferencePhotoUrl(getCharacterImageUrl(initialCharacterData?.user_id, initialCharacterData?.reference_photo_filename));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const token = localStorage.getItem('accessToken');
    if (!token || !characterId) {
      setError('Authentication token or Character ID missing.');
      setIsSubmitting(false);
      return;
    }

    const characterTextData: Omit<RoleplayCharacterForm, 'profilePhoto' | 'referencePhoto'> = { ...formData };
    delete (characterTextData as any).profilePhoto;
    delete (characterTextData as any).referencePhoto;

    try {
      // 1. Update character text data
      const updateResponse = await fetch(`${API_BASE_URL}/api/characters/${characterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(characterTextData),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.detail || 'Failed to update character.');
      }
      const updatedCharacter: RoleplayCharacterData = await updateResponse.json();
      setSuccessMessage(`Character "${updatedCharacter.name}" updated successfully!`);

      // 2. Upload profile photo if a new one was selected
      if (formData.profilePhoto) {
        const photoFormData = new FormData();
        photoFormData.append('file', formData.profilePhoto);
        await fetch(`${API_BASE_URL}/api/characters/${characterId}/profile-photo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: photoFormData,
        });
        // Non-critical error for now, main update succeeded.
      }

      // 3. Upload reference photo if a new one was selected
      if (formData.referencePhoto) {
        const photoFormData = new FormData();
        photoFormData.append('file', formData.referencePhoto);
        await fetch(`${API_BASE_URL}/api/characters/${characterId}/reference-photo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: photoFormData,
        });
      }
      // Optionally, redirect after a short delay
      setTimeout(() => router.push(`/view/${initialCharacterData?.user_id}/${characterId}`), 1500);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder-gray-400 text-white";
  const textareaClass = `${inputClass} min-h-[100px]`;
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";

  if (isLoading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><p>Loading character for editing...</p></div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 md:p-8">
      <div className="bg-gray-800 p-6 md:p-10 rounded-xl shadow-2xl w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-teal-400">Edit Character: {initialCharacterData?.name}</h1>
        </div>

        {error && <p className="mb-4 text-red-400 text-sm text-center bg-red-900 p-3 rounded-md">{error}</p>}
        {successMessage && <p className="mb-4 text-green-400 text-sm text-center bg-green-900 p-3 rounded-md">{successMessage}</p>}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Core Identity (Same as create) */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Core Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label htmlFor="name" className={labelClass}>Full Name</label><input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className={inputClass} placeholder="e.g., Seraphina Moonwhisper" required /></div>
              <div><label htmlFor="nickname" className={labelClass}>Nickname(s)</label><input type="text" id="nickname" name="nickname" value={formData.nickname} onChange={handleInputChange} className={inputClass} placeholder="e.g., Sera, Moonie" /></div>
            </div>
            <div className="mt-6"><label htmlFor="description" className={labelClass}>Brief Description / Tagline</label><textarea id="description" name="description" value={formData.description} onChange={handleInputChange} className={textareaClass} placeholder="A mysterious sorceress with a hidden past..." /></div>
            <div className="mt-6"><label htmlFor="birthday" className={labelClass}>Birthday / Age</label><input type="text" id="birthday" name="birthday" value={formData.birthday} onChange={handleInputChange} className={inputClass} placeholder="e.g., Spring Equinox, 27 cycles" /></div>
          </section>

          {/* Section 2: Visuals - with previews */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Visuals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div>
                <label htmlFor="profilePhoto" className={labelClass}>New Profile Photo (Avatar)</label>
                {currentProfilePhotoUrl && <img src={currentProfilePhotoUrl} alt="Current Profile" className="w-32 h-32 object-cover rounded-md mb-2"/>}
                <input type="file" id="profilePhoto" name="profilePhoto" onChange={handleFileChange} className={`${inputClass} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100`} accept="image/*" />
              </div>
              <div>
                <label htmlFor="referencePhoto" className={labelClass}>New Main Reference Photo</label>
                {currentReferencePhotoUrl && <img src={currentReferencePhotoUrl} alt="Current Reference" className="w-32 h-32 object-cover rounded-md mb-2"/>}
                <input type="file" id="referencePhoto" name="referencePhoto" onChange={handleFileChange} className={`${inputClass} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100`} accept="image/*" />
              </div>
            </div>
            <div className="mt-6"><label htmlFor="design" className={labelClass}>Detailed Design / Appearance</label><textarea id="design" name="design" value={formData.design} onChange={handleInputChange} className={textareaClass} placeholder="Describe their physical features, clothing, distinguishing marks, etc." /></div>
          </section>

          {/* Section 3: Traits & Background (Same as create) */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Traits & Background</h2>
            <div><label htmlFor="abilities" className={labelClass}>Abilities / Skills</label><textarea id="abilities" name="abilities" value={formData.abilities} onChange={handleInputChange} className={textareaClass} placeholder="List their notable talents, magical prowess, combat skills, etc." /></div>
            <div className="mt-6"><label htmlFor="interests" className={labelClass}>Interests / Likes</label><textarea id="interests" name="interests" value={formData.interests} onChange={handleInputChange} className={textareaClass} placeholder="What do they enjoy? Hobbies, passions, etc." /></div>
            <div className="mt-6"><label htmlFor="disinterests" className={labelClass}>Disinterests / Dislikes</label><textarea id="disinterests" name="disinterests" value={formData.disinterests} onChange={handleInputChange} className={textareaClass} placeholder="What do they avoid or detest?" /></div>
          </section>

          {/* Section 4: Lore & Setting (Same as create) */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Lore & Setting</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label htmlFor="home_world" className={labelClass}>Home World</label><input type="text" id="home_world" name="home_world" value={formData.home_world} onChange={handleInputChange} className={inputClass} placeholder="e.g., Eldoria, Terra Nova" /></div>
              <div><label htmlFor="universe" className={labelClass}>Universe / Setting</label><input type="text" id="universe" name="universe" value={formData.universe} onChange={handleInputChange} className={inputClass} placeholder="e.g., The Azure Expanse" /></div>
              <div><label htmlFor="time_period" className={labelClass}>Time Period</label><input type="text" id="time_period" name="time_period" value={formData.time_period} onChange={handleInputChange} className={inputClass} placeholder="e.g., Age of Dragons, 3042 AD" /></div>
            </div>
            <div className="mt-6"><label htmlFor="lore" className={labelClass}>Backstory / Lore</label><textarea id="lore" name="lore" value={formData.lore} onChange={handleInputChange} className={textareaClass} placeholder="Detail their history, significant events, relationships, and personal lore." /></div>
          </section>

          {/* Section 5: Equipment (Same as create) */}
          <section className="p-6 bg-gray-750 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-teal-300 mb-6 border-b border-gray-700 pb-3">Equipment & Possessions</h2>
            <div><label htmlFor="main_weapon" className={labelClass}>Main Weapon(s)</label><input type="text" id="main_weapon" name="main_weapon" value={formData.main_weapon} onChange={handleInputChange} className={inputClass} placeholder="e.g., Ancestral Longsword, Staff of Whispers" /></div>
            <div className="mt-6"><label htmlFor="armor_attire" className={labelClass}>Armor / Attire</label><textarea id="armor_attire" name="armor_attire" value={formData.armor_attire} onChange={handleInputChange} className={textareaClass} placeholder="Describe their typical combat gear or everyday clothing." /></div>
            <div className="mt-6"><label htmlFor="key_items" className={labelClass}>Key Items / Artifacts</label><textarea id="key_items" name="key_items" value={formData.key_items} onChange={handleInputChange} className={textareaClass} placeholder="List important unique items they possess." /></div>
            <div className="mt-6"><label htmlFor="general_inventory" className={labelClass}>General Inventory / Pouch</label><textarea id="general_inventory" name="general_inventory" value={formData.general_inventory} onChange={handleInputChange} className={textareaClass} placeholder="Common items, tools, currency, etc." /></div>
          </section>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-6 border-t border-gray-700">
            <Link href={`/view/${initialCharacterData?.user_id}/${characterId}`} className="text-gray-400 hover:text-gray-200 transition-colors text-sm order-2 sm:order-1">
              &larr; Back to View Character
            </Link>
            <button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition duration-150 order-1 sm:order-2 w-full sm:w-auto disabled:opacity-50"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}