// src/components/notifications/NotificationBell.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import Link from 'next/link';
import { BellIcon, XMarkIcon, UserCircleIcon, Cog6ToothIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline'; // Using Heroicons

const NotificationItem: React.FC<{ notification: ReturnType<typeof useNotifications>['notifications'][0], onMarkRead: (id: number) => void }> = ({ notification, onMarkRead }) => {
  const handleItemClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    // Navigation will be handled by the Link component if notification.link exists
  };

  const content = (
    <div className={`p-3 border-b border-gray-700 last:border-b-0 ${notification.is_read ? 'opacity-60' : 'hover:bg-gray-650'}`} onClick={handleItemClick}>
      <p className="text-sm text-gray-200">{notification.content}</p>
      <p className="text-xs text-gray-400 mt-1">{new Date(notification.timestamp).toLocaleString()}</p>
    </div>
  );

  if (notification.link) {
    return (
      // Removed legacyBehavior and passHref, moved className from <a> to <Link>
      <Link href={notification.link} className="block cursor-pointer">
        {content}
      </Link>
    );
  }
  return <div className="cursor-pointer">{content}</div>;
};

export const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading, error, fetchNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const sortedNotifications = [...notifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Close sidebar if clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          fetchNotifications(); // Force fetch when opening
        }}
        className="relative p-2 rounded-full text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
        aria-label="View notifications"
      >
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-4 w-4 transform -translate-y-1/2 translate-x-1/2 rounded-full text-xs font-bold bg-red-500 text-white text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ease-in-out" onClick={() => setIsOpen(false)}></div>
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full w-80 md:w-96 bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-sidebar-title"
      >
        {/* Sidebar Header */}
        <div
          className="flex items-center justify-between p-4 border-b border-gray-700"
        >
          <h2 id="notification-sidebar-title" className="text-xl font-semibold text-indigo-400">Activity Center</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
            aria-label="Close notifications sidebar"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Quick Links */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Quick Links</h3>
          <div className="space-y-2">
            <Link href="/dm" onClick={() => setIsOpen(false)} className="flex items-center p-2 rounded-md text-gray-200 hover:bg-gray-700 hover:text-indigo-300 transition-colors">
              <ChatBubbleLeftEllipsisIcon className="h-5 w-5 mr-3" />
              Direct Messages
            </Link>
            <Link href="/profile" onClick={() => setIsOpen(false)} className="flex items-center p-2 rounded-md text-gray-200 hover:bg-gray-700 hover:text-indigo-300 transition-colors">
              <UserCircleIcon className="h-5 w-5 mr-3" />
              My Profile
            </Link>
            <Link href="/settings" onClick={() => setIsOpen(false)} className="flex items-center p-2 rounded-md text-gray-200 hover:bg-gray-700 hover:text-indigo-300 transition-colors">
              <Cog6ToothIcon className="h-5 w-5 mr-3" />
              Settings
            </Link>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 flex justify-between items-center">
            <h3 className="text-md font-semibold text-gray-100">Notifications</h3>
            {notifications.some(n => !n.is_read) && unreadCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto custom-dm-scrollbar">
            {isLoading && <p className="p-4 text-gray-400 text-sm text-center">Loading notifications...</p>}
            {error && <p className="p-4 text-red-400 text-sm text-center">{error}</p>}
            {!isLoading && !error && sortedNotifications.length === 0 && (
              <p className="p-4 text-gray-400 text-sm text-center">No notifications yet.</p>
            )}
            {!isLoading && !error && sortedNotifications.map(notification => (
              <NotificationItem key={notification.id} notification={notification} onMarkRead={markAsRead} />
            ))}
          </div>
        </div>

        {/* Active Area Items Section (Placeholder) */}
        <div className="p-4 border-t border-gray-700 mt-auto">
          <h3 className="text-md font-semibold text-gray-100 mb-2">Active Area</h3>
          <p className="text-sm text-gray-400 text-center">Content for active games or events will appear here soon!</p>
        </div>
      </div>
    </>
  );
};