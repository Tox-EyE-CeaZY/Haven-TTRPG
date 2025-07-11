// src/components/layout/GlobalNotificationHandler.tsx
'use client';

import { useState, useEffect } from 'react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { usePathname } from 'next/navigation';

export default function GlobalNotificationHandler() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken');
      // Add more robust token validation if needed (e.g., check expiry)
      setAuthLoading(false); // Set loading to false after check
      setIsAuthenticated(!!token);
    };

    checkAuth(); // Initial check

    // Listen for storage changes to update auth status (e.g., on login/logout in other tabs)
    window.addEventListener('storage', checkAuth);
    // Custom event for same-tab login/logout updates
    window.addEventListener('authChange', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('authChange', checkAuth);
    };
  }, []); // Run once on mount, and on authChange/storage events

  if (authLoading) {
    return null; // Don't render anything while checking auth
  }

  // Don't render the global floating bell on specific pages that will have their own inline one.
  if (pathname === '/dm' || pathname === '/admin/test/chat/gdm-rp') {
    return null;
  }
  
  return (
    <>
      {isAuthenticated && (
        <div className="fixed bottom-5 right-5 z-[51]"> {/* Ensure z-index is higher than sidebar's overlay if needed */}
          <NotificationBell />
        </div>
      )}
    </>
  );
}