// src/app/view/[userId]/[characterId]/gallery/page.tsx
'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

interface CharacterCoreData {
  id: number;
  user_id: number;
  name: string;
  profile_photo_filename?: string | null;
  reference_photo_filename?: string | null;
}

interface GalleryImageRecord { // Renamed to avoid confusion with HTMLImageElement
  id: number; // Now using number from DB
  url: string;
  alt: string;
  filename: string;
  character_id: number;
  user_id: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const getCharacterImageUrl = (userId: string | number, filename: string | null | undefined): string | null => {
  if (!filename) return null;
  return `${API_BASE_URL}/api/characters/images/${userId}/${filename}`;
};

export default function CharacterGalleryPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string; // User ID of the character owner
  const characterIdFromUrl = params.characterId as string; // Renamed for clarity

  const [character, setCharacter] = useState<CharacterCoreData | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [currentLoggedInUserId, setCurrentLoggedInUserId] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [altText, setAltText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      // Allow viewing if not logged in
      setCurrentLoggedInUserId(null);
    } else {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentLoggedInUserId(payload.user_id);
      } catch (e) {
        console.error("Token decode error:", e);
        localStorage.removeItem('accessToken');
        setCurrentLoggedInUserId(null);
      }
    }

    const fetchCharacterAndGallery = async () => {
      setLoading(true);
      setError(null);
      try {
        // NEW: Call a hypothetical public endpoint for character core data
        const charResponse = await fetch(`${API_BASE_URL}/api/public/characters/${userId}/${characterIdFromUrl}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!charResponse.ok) throw new Error('Failed to fetch character data.');
        const charData: CharacterCoreData = await charResponse.json();
        setCharacter(charData);

        // NEW: Call a hypothetical public endpoint for gallery images
        const galleryResponse = await fetch(`${API_BASE_URL}/api/public/characters/${userId}/${characterIdFromUrl}/gallery-images`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!galleryResponse.ok) throw new Error('Failed to fetch gallery images.');
        const galleryData: Omit<GalleryImageRecord, 'url' | 'alt'>[] = await galleryResponse.json();

        const allImages: GalleryImageRecord[] = [];
        // Add profile photo if exists
        if (charData.profile_photo_filename) {
          const url = getCharacterImageUrl(charData.user_id, charData.profile_photo_filename);
          if (url) allImages.push({ id: -1, url, alt: `${charData.name} - Profile`, filename: charData.profile_photo_filename, character_id: charData.id, user_id: charData.user_id }); // Use a dummy ID like -1 for profile
        }
        // Add reference photo if exists
        if (charData.reference_photo_filename) {
          const url = getCharacterImageUrl(charData.user_id, charData.reference_photo_filename);
          if (url) allImages.push({ id: -2, url, alt: `${charData.name} - Reference`, filename: charData.reference_photo_filename, character_id: charData.id, user_id: charData.user_id }); // Use a dummy ID like -2 for reference
        }

        galleryData.forEach(img => {
          allImages.push({ ...img, url: getCharacterImageUrl(img.user_id, img.filename)!, alt: img.alt_text || `Gallery image for ${charData.name}` });
        });
        setGalleryImages(allImages);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId && characterIdFromUrl) { // Use owner's userId and characterIdFromUrl
      fetchCharacterAndGallery();
    }
  }, [characterIdFromUrl, router, userId]);

  useEffect(() => {
    if (character && currentLoggedInUserId) {
      setIsOwner(character.user_id === currentLoggedInUserId);
    }
  }, [character, currentLoggedInUserId]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleImageUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile || !character) return;

    setUploading(true);
    setUploadError(null);
    const token = localStorage.getItem('accessToken');
    if (!token || !isOwner) { // Ensure only owner can upload
      setUploadError("Authentication token not found.");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (altText) {
      formData.append('alt_text', altText);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/characters/${characterIdFromUrl}/gallery-images`, { // Use characterIdFromUrl
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // Content-Type is set by browser for FormData
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to upload image.');
      }
      const newImageRecord: Omit<GalleryImageRecord, 'url' | 'alt'> = await response.json();
      const newImageFull: GalleryImageRecord = {
        ...newImageRecord,
        url: getCharacterImageUrl(newImageRecord.user_id, newImageRecord.filename)!,
        alt: newImageRecord.alt_text || `Gallery image for ${character.name}`
      };

      setGalleryImages(prev => [...prev, newImageFull]);
      setSelectedFile(null);
      setAltText(''); // Clear alt text input
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: number, filename: string) => {
    // Placeholder for delete functionality
    // Requires: DELETE /api/characters/{characterId}/gallery-images/{imageId}
    // This should also check for isOwner before proceeding
    alert(`Owner-only: Delete functionality for image ID ${imageId} (filename: ${filename}) is not yet implemented.`);
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><p>Loading gallery...</p></div>;
  if (error) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 text-center"><p className="text-red-400 bg-red-800 p-4 rounded-md">{error}</p><Link href={`/view/${userId}/${characterIdFromUrl}`} className="mt-4 text-indigo-400 hover:underline">Back to Character</Link></div>;
  if (!character) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><p>Character data not found for gallery.</p></div>;

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
        <div className="container mx-auto">
          <div className="mb-6 flex justify-between items-center">
            <Link href={`/view/${character.user_id}/${character.id}`} className="text-indigo-400 hover:text-indigo-200 transition-colors">
              &larr; Back to {character.name}'s Profile
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-sky-400">{character.name}'s Gallery</h1>
          </div>

          {isOwner && (
            <form onSubmit={handleImageUpload} className="mb-8 p-6 bg-gray-800 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-sky-300 mb-3">Upload New Image</h2>
              <div className="mb-3">
                <label htmlFor="galleryFile" className="block text-sm font-medium text-gray-300 mb-1">Image File</label>
                <input type="file" id="galleryFile" onChange={handleFileSelect} accept="image/*" className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100" />
              </div>
              <div className="mb-3">
                <label htmlFor="altText" className="block text-sm font-medium text-gray-300 mb-1">Alt Text (Optional)</label>
                <input type="text" id="altText" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Brief description of the image" className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md placeholder-gray-500" />
              </div>
              {uploadError && <p className="text-red-400 text-sm mb-2">{uploadError}</p>}
              <button type="submit" disabled={!selectedFile || uploading} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-5 rounded-md disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload Image'}
              </button>
            </form>
          )}

          {galleryImages.length === 0 && !isOwner && (
            <p className="text-center text-gray-500 text-lg">This gallery is empty.</p>
          )}
           {galleryImages.length === 0 && isOwner && (
            <p className="text-center text-gray-500 text-lg">This gallery is empty. Upload some images!</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {galleryImages.map((img) => (
              <div key={img.id} className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden shadow-lg group">
                <img 
                  src={img.url} 
                  alt={img.alt} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                  onClick={() => setLightboxImage(img.url)} 
                />
                {isOwner && img.id > 0 && ( // Only show delete for actual gallery images, not profile/ref placeholders
                  <button onClick={() => handleDeleteImage(img.id, img.filename)} className="absolute top-1 right-1 bg-red-700 hover:bg-red-800 text-white p-1 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Image">
                    X
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox Modal (same as character viewer) */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Enlarged view"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
