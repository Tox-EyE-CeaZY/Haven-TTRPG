// src/app/profile/page.tsx
'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserProfile {
  id: number;
  username: string;
  nickname?: string | null;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  bio?: string | null;
  avatar_url?: string | null;
  social_links?: { [key: string]: string } | null;
}

interface EditableItem {
  id: string; // For React key and local manipulation
  type: 'link' | 'content';
  // For type 'link'
  platformName: string; // e.g., Twitter, GitHub
  url: string;          // The actual URL
  // For type 'content'
  title: string;        // e.g., My Hobbies, Favorite Quote
  textContent: string;  // The actual text content
}

interface EditableProfileState {
  nickname: string | null;
  bio: string | null;
  items: EditableItem[]; // Renamed from social_links
}

const API_LINK_PREFIX = 'link_';
const API_CONTENT_PREFIX = 'content_';
export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editableProfile, setEditableProfile] = useState<EditableProfileState>({
    nickname: '',
    bio: '',
    items: [], // Ensure this uses 'items' and not 'social_links'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Helper function to construct full avatar URL
  const getFullAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) {
      return url;
    }
    return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login?message=Please login to view your profile');
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('accessToken');
          router.push('/login?message=Session expired. Please login again.');
          return;
        }

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to fetch profile');
        }

        const data: UserProfile = await response.json();
        const initialEditableItems: EditableItem[] = [];
        if (data.social_links) {
          Object.entries(data.social_links).forEach(([key, value], index) => {
            const id = `item-initial-${Date.now()}-${index}`;
            if (key.startsWith(API_LINK_PREFIX)) {
              initialEditableItems.push({ id, type: 'link', platformName: key.substring(API_LINK_PREFIX.length), url: value, title: '', textContent: '' });
            } else if (key.startsWith(API_CONTENT_PREFIX)) {
              initialEditableItems.push({ id, type: 'content', title: key.substring(API_CONTENT_PREFIX.length), textContent: value, platformName: '', url: '' });
            } else { // Assume old format or simple link for backward compatibility
              initialEditableItems.push({ id, type: 'link', platformName: key, url: value, title: '', textContent: '' });
            }
          });
        }
        setProfile(data);
        setEditableProfile({
          nickname: data.nickname || '',
          bio: data.bio || '',
          items: initialEditableItems,
        });
        setAvatarPreview(getFullAvatarUrl(data.avatar_url)); // Use helper for initial preview
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file)); // Create a temporary URL for preview
      setError(null); // Clear previous errors
    } else {
      setSelectedAvatarFile(null);
      setAvatarPreview(getFullAvatarUrl(profile?.avatar_url)); // Use helper
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditableProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (id: string, field: keyof EditableItem, value: string | 'link' | 'content') => {
    setEditableProfile(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          // If type changes, reset other type-specific fields
          if (field === 'type') {
            if (value === 'link') {
              updatedItem.title = '';
              updatedItem.textContent = '';
            } else if (value === 'content') {
              updatedItem.platformName = '';
              updatedItem.url = '';
            }
          }
          return updatedItem;
        }
        return item;
      }),
    }));
  };

  const addItemField = () => {
    setEditableProfile(prev => ({
      ...prev,
      items: [
        ...prev.items,
        // Add a new empty item, defaulting to type 'link'
        { id: `new-item-${Date.now()}-${Math.random()}`, type: 'link', platformName: '', url: '', title: '', textContent: '' }
      ]
    }));
  };

  const removeItemField = (idToRemove: string) => {
    setEditableProfile(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== idToRemove)
    }));
  };

  const handleProfileTextSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const itemsPayload: { [key: string]: string } = {};
    editableProfile.items.forEach(item => {
      if (item.type === 'link' && item.platformName.trim() && item.url.trim()) {
        itemsPayload[`${API_LINK_PREFIX}${item.platformName.trim()}`] = item.url.trim();
      } else if (item.type === 'content' && item.title.trim() && item.textContent.trim()) {
        itemsPayload[`${API_CONTENT_PREFIX}${item.title.trim()}`] = item.textContent.trim();
      }
    });
    const payload = {
      nickname: editableProfile.nickname,
      bio: editableProfile.bio,
      // The backend expects a field named 'social_links' for this JSON object
      social_links: itemsPayload
    };

    const token = localStorage.getItem('accessToken');
    if (!token) { router.push('/login'); return; }
    let profileUpdatedSuccessfully = false;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to update profile');
      }

      const updatedProfileData: UserProfile = await response.json();
      // Only update text fields from this response, avatar comes from avatar upload
      setProfile(prev => ({ ...prev, ...updatedProfileData, avatar_url: prev?.avatar_url || updatedProfileData.avatar_url }));
      
      const updatedEditableItems: EditableItem[] = [];
      if (updatedProfileData.social_links) {
        Object.entries(updatedProfileData.social_links).forEach(([key, value], index) => {
          const id = `updated-item-${Date.now()}-${index}`;
          if (key.startsWith(API_LINK_PREFIX)) {
            updatedEditableItems.push({ id, type: 'link', platformName: key.substring(API_LINK_PREFIX.length), url: value, title: '', textContent: '' });
          } else if (key.startsWith(API_CONTENT_PREFIX)) {
            updatedEditableItems.push({ id, type: 'content', title: key.substring(API_CONTENT_PREFIX.length), textContent: value, platformName: '', url: '' });
          } else { // Assume old format or simple link
            updatedEditableItems.push({ id, type: 'link', platformName: key, url: value, title: '', textContent: '' });
          }
        });
      }
      setEditableProfile({
        nickname: updatedProfileData.nickname || '',
        bio: updatedProfileData.bio || '',
        items: updatedEditableItems,
      });
      profileUpdatedSuccessfully = true;
    } catch (err: any) {
      setError(err.message);
      setSaving(false); // Stop saving indicator if text update fails
      return; // Don't proceed to avatar upload if text fails
    }

    // If avatar is selected, upload it
    if (selectedAvatarFile) {
      const avatarFormData = new FormData();
      avatarFormData.append('file', selectedAvatarFile);

      try {
        const avatarResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // 'Content-Type': 'multipart/form-data' is set automatically by browser for FormData
          },
          body: avatarFormData,
        });

        if (!avatarResponse.ok) {
          const errData = await avatarResponse.json();
          throw new Error(errData.detail || 'Failed to upload avatar');
        }
        const updatedProfileWithAvatar: UserProfile = await avatarResponse.json();
        setProfile(updatedProfileWithAvatar); // This response contains the new avatar_url
        setAvatarPreview(getFullAvatarUrl(updatedProfileWithAvatar.avatar_url)); // Use helper
        setSelectedAvatarFile(null); // Clear selected file after successful upload
        // If text update was also successful
        if (profileUpdatedSuccessfully) {
          setSuccessMessage('Profile and avatar updated successfully!');
        } else {
          setSuccessMessage('Avatar updated successfully!');
        }
      } catch (err: any) {
        setError((prevError) => prevError ? `${prevError}. ${err.message}` : err.message);
      }
    } else if (profileUpdatedSuccessfully) {
      setSuccessMessage('Profile updated successfully!');
    }

    if (profileUpdatedSuccessfully || selectedAvatarFile) {
        setIsEditing(false); // Exit edit mode if any part was successful
    }
    setSaving(false); // Ensure saving is set to false at the very end
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-800 text-white flex items-center justify-center"><p>Loading profile...</p></div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-800 text-white flex flex-col items-center justify-center">
        <p className="text-xl text-red-400">{error || 'Could not load profile.'}</p>
        <Link href="/" className="mt-4 text-indigo-400 hover:underline">Go to Homepage</Link>
      </div>
    );
  }

  const commonInputClass = "w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-gray-400 text-white";
  // Calculate the displayable avatar source once
  const displayAvatarSrc = getFullAvatarUrl(isEditing ? avatarPreview : profile?.avatar_url);

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4 md:p-8 flex justify-center">
      <div className="bg-gray-700 p-6 md:p-8 rounded-xl shadow-2xl w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-400">My Profile</h1>
          {!isEditing && (
            <button
              onClick={() => {
                setIsEditing(true);
                // Reset editable profile to current profile state when entering edit mode
                const currentEditableItems: EditableItem[] = [];
                if (profile?.social_links) {
                  Object.entries(profile.social_links).forEach(([key, value], index) => {
                    const id = `current-item-${Date.now()}-${index}`;
                    if (key.startsWith(API_LINK_PREFIX)) {
                      currentEditableItems.push({ id, type: 'link', platformName: key.substring(API_LINK_PREFIX.length), url: value, title: '', textContent: '' });
                    } else if (key.startsWith(API_CONTENT_PREFIX)) {
                      currentEditableItems.push({ id, type: 'content', title: key.substring(API_CONTENT_PREFIX.length), textContent: value, platformName: '', url: '' });
                    } else {
                      currentEditableItems.push({ id, type: 'link', platformName: key, url: value, title: '', textContent: '' });
                    }
                  });
                }
                setEditableProfile({
                  nickname: profile?.nickname || '',
                  bio: profile?.bio || '',
                  items: currentEditableItems,
                });
                setAvatarPreview(getFullAvatarUrl(profile?.avatar_url)); // Use helper
                setSelectedAvatarFile(null);
                setError(null);
                setSuccessMessage(null);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md"
            >
              Edit Profile
            </button>
          )}
        </div>

        {error && <p className="mb-4 text-red-400 text-sm text-center bg-red-900 p-2 rounded">{error}</p>}
        {successMessage && <p className="mb-4 text-green-400 text-sm text-center bg-green-900 p-2 rounded">{successMessage}</p>}

        <form onSubmit={handleProfileTextSubmit} className="space-y-6">
          {/* Avatar Display and Upload */}
          <div className="flex flex-col items-center space-y-4 mb-6">
            {displayAvatarSrc && (
              <img
                src={displayAvatarSrc}
                alt={profile?.username ? `${profile.username}'s avatar` : 'User avatar'}
                className="w-32 h-32 rounded-full object-cover border-4 border-indigo-500"
              />
            )}
            {isEditing && (
              <div>
                <label htmlFor="avatarFile" className="block text-sm font-medium text-gray-300 mb-1 text-center">
                  Change Avatar (PNG, JPG, GIF - Max 2MB)
                </label>
                <input
                  type="file"
                  id="avatarFile"
                  name="avatarFile"
                  accept=".png,.jpg,.jpeg,.gif"
                  onChange={handleAvatarFileChange}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            )}
          </div>

          {/* Username and Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <p className="text-lg text-gray-100 bg-gray-600 p-2 rounded-md">{profile.username}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <p className="text-lg text-gray-100 bg-gray-600 p-2 rounded-md">{profile.email}</p>
          </div>

          {/* Nickname */}
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-300 mb-1">Nickname (Display Name)</label>
            {isEditing ? (
              <input type="text" id="nickname" name="nickname" value={editableProfile.nickname || ''} onChange={handleInputChange} className={commonInputClass} placeholder="Your awesome nickname" />
            ) : (
              <p className="text-gray-200 bg-gray-600 p-2 rounded-md min-h-[2.5rem]">{profile.nickname || <span className="text-gray-400">No nickname set.</span>}</p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-300 mb-1">Bio</label>
            {isEditing ? (
              <textarea id="bio" name="bio" value={editableProfile.bio || ''} onChange={handleInputChange} rows={3} className={commonInputClass} placeholder="Tell us a bit about yourself..." />
            ) : (
              <p className="text-gray-200 bg-gray-600 p-2 rounded-md min-h-[4rem] whitespace-pre-wrap">{profile.bio || <span className="text-gray-400">No bio yet.</span>}</p>
            )}
          </div>

          {/* Items (formerly Social Links) */}
          <div>
            <h3 className="text-lg font-medium text-gray-200 mb-3">Also -</h3>
            {isEditing ? (
              <div className="space-y-4">
                {editableProfile.items.map((item) => (
                  <div key={item.id} className="p-3 border border-gray-600 rounded-md space-y-3">
                    <div className="flex items-center justify-between">
                      <select
                        value={item.type}
                        onChange={(e) => handleItemChange(item.id, 'type', e.target.value as 'link' | 'content')}
                        className={commonInputClass + " text-sm !w-auto mr-2"}
                      >
                        <option value="link">Link</option>
                        <option value="content">Content</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeItemField(item.id)}
                        className="p-2 bg-red-700 hover:bg-red-800 text-white rounded-md text-xs"
                        aria-label="Remove item"
                      >
                        Remove
                      </button>
                    </div>

                    {item.type === 'link' && (
                      <>
                        <input
                          type="text"
                          value={item.platformName}
                          onChange={(e) => handleItemChange(item.id, 'platformName', e.target.value)}
                          placeholder="Platform Name (e.g., Twitter, Website)"
                          className={commonInputClass + " text-sm"}
                        />
                        <input
                          type="url"
                          value={item.url}
                          onChange={(e) => handleItemChange(item.id, 'url', e.target.value)}
                          placeholder="URL (e.g., https://twitter.com/yourprofile)"
                          className={commonInputClass + " text-sm"}
                        />
                      </>
                    )}

                    {item.type === 'content' && (
                      <>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleItemChange(item.id, 'title', e.target.value)}
                          placeholder="Title (e.g., My Hobbies, Favorite Quote)"
                          className={commonInputClass + " text-sm"}
                        />
                        <textarea
                          value={item.textContent}
                          onChange={(e) => handleItemChange(item.id, 'textContent', e.target.value)}
                          placeholder="Your content here..."
                          rows={3}
                          className={commonInputClass + " text-sm"}
                        />
                      </>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItemField}
                  className="w-full flex items-center justify-center py-2 px-4 border-2 border-dashed border-gray-500 hover:border-indigo-500 text-gray-400 hover:text-indigo-400 rounded-md transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item
                </button>
              </div>
            ) : (
              profile.social_links && Object.keys(profile.social_links).length > 0 ? (
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
              ) : (
                <p className="text-gray-400 bg-gray-600 p-4 rounded-md">No social links added yet.</p>
              )
            )}
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                  setSuccessMessage(null);
                  setSelectedAvatarFile(null);
                  setAvatarPreview(getFullAvatarUrl(profile?.avatar_url)); // Use helper
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
         <p className="mt-8 text-center">
            <Link href="/" className="text-indigo-400 hover:text-indigo-300">
              &larr; Back to Homepage
            </Link>
          </p>
      </div>
    </div>
  );
}