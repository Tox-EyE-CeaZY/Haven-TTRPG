// src/app/dm/page.tsx
'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import Link from 'next/link'; // Import Link
import ReactMarkdown from 'react-markdown';
import { useRouter, useSearchParams } from 'next/navigation'; // Import useSearchParams
import { NotificationBell } from '@/components/notifications/NotificationBell'; // Import NotificationBell
import { useNotifications } from '@/contexts/NotificationContext'; // Import useNotifications

interface UserSchema {
  id: number;
  username: string;
  nickname?: string | null;
  avatar_url?: string | null; // Add avatar_url
}

interface DirectMessageSchema {
  id: number;
  content: string;
  sender_id: number;
  receiver_id: number;
  timestamp: string; // Assuming datetime comes as string from API
  is_read: boolean;
  sender: UserSchema;
  receiver: UserSchema;
}

interface CurrentUser {
  id: number;
  username: string;
  // nickname?: string | null; // CurrentUser might also have nickname if needed
  // avatar_url?: string | null; // CurrentUser might also have avatar if needed elsewhere
}

interface ConversationSchema {
  other_user: UserSchema;
  last_message: DirectMessageSchema | null;
  unread_count: number;
}

// Helper function to construct full avatar URL
const getFullAvatarUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('blob:')) {
    return url;
  }
  return `${process.env.NEXT_PUBLIC_API_URL || ''}${url}`;
};

export default function DirectMessagePage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [searchedUsername, setSearchedUsername] = useState('');
  const [targetUser, setTargetUser] = useState<UserSchema | null>(null);
  const [messages, setMessages] = useState<DirectMessageSchema[]>([]);
  const [newMessageContent, setNewMessageContent] = useState('');

  const [conversations, setConversations] = useState<ConversationSchema[]>([]);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorSearch, setErrorSearch] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [errorSendingMessage, setErrorSendingMessage] = useState<string | null>(null);
  // const [focusInputAfterSend, setFocusInputAfterSend] = useState(false); // No longer needed if focus is retained
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [errorConversations, setErrorConversations] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams(); // For reading query parameters
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const usernameSearchInputRef = useRef<HTMLInputElement | null>(null); // Ref for username search input
  const messageInputRef = useRef<HTMLInputElement | null>(null); // Ref for the message input
  const { showToast, fetchNotifications: refreshNotificationsList } = useNotifications(); // Get showToast and refresh from context

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login?message=Please login to use direct messages');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.sub && payload.user_id) {
        setCurrentUser({ id: payload.user_id, username: payload.sub });
      } else {
        throw new Error("Token payload invalid");
      }
    } catch (e) {
      console.error("Auth error:", e);
      localStorage.removeItem('accessToken');
      router.push('/login?message=Session invalid. Please login again.');
    }
  }, [router]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const updateAndSortConversations = (updatedOrNewMessage: DirectMessageSchema) => {
    setConversations(prevConvos => {
      let existingConvo = false;
      const updatedConvos = prevConvos.map(convo => {
        if ((convo.other_user.id === updatedOrNewMessage.sender_id && currentUser && updatedOrNewMessage.receiver_id === currentUser.id) ||
            (convo.other_user.id === updatedOrNewMessage.receiver_id && currentUser && updatedOrNewMessage.sender_id === currentUser.id)) {
          existingConvo = true;
          return { ...convo, last_message: updatedOrNewMessage };
        }
        return convo;
      });

      if (!existingConvo && currentUser) {
        const otherUserInvolved = updatedOrNewMessage.sender_id === currentUser.id ? updatedOrNewMessage.receiver : updatedOrNewMessage.sender;
        updatedConvos.push({
          other_user: otherUserInvolved,
          last_message: updatedOrNewMessage,
          unread_count: 0
        });
      }

      return updatedConvos.sort((a, b) => {
        if (!a.last_message) return 1;
        if (!b.last_message) return -1;
        return new Date(b.last_message.timestamp).getTime() - new Date(a.last_message.timestamp).getTime();
      });
    });
  };

  // Fetch conversations
  useEffect(() => {
    if (currentUser) {
      const fetchConversations = async () => {
        setLoadingConversations(true);
        setErrorConversations(null);
        const token = localStorage.getItem('accessToken');
        try {
          // Use the environment variable
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me/conversations`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to fetch conversations.');
          }
          const data: ConversationSchema[] = await response.json();
          data.sort((a, b) => {
            if (!a.last_message) return 1;
            if (!b.last_message) return -1;
            return new Date(b.last_message.timestamp).getTime() - new Date(a.last_message.timestamp).getTime();
          });
          setConversations(data);
        } catch (err: any) {
          setErrorConversations(err.message);
        } finally {
          setLoadingConversations(false);
        }
      };
      fetchConversations();
    }
  }, [currentUser]);

  // WebSocket connection effect
  useEffect(() => {
    if (!currentUser) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Construct WebSocket URL using the environment variable (replace http with ws)
    // Ensure ws.current is null before attempting a new connection to avoid duplicates if the effect re-runs.
    if (ws.current) {
      // If a WebSocket connection already exists, don't create a new one.
      // This might happen due to fast re-renders.
      // You could add logic here to check its readyState if needed,
      // but for now, just preventing re-creation is a good step.
      return;
    }

    const wsBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws');
    const wsUrl = `${wsBaseUrl}/api/ws/dm?token=${encodeURIComponent(token)}`;
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      console.log('DM WebSocket Connected');
      ws.current = newWs; // Assign to ref only after successful open
    };

    newWs.onmessage = (event) => {
      try {
        const receivedMessage: DirectMessageSchema = JSON.parse(event.data as string);
        // Update conversation list regardless
        updateAndSortConversations(receivedMessage);
        refreshNotificationsList(); // Refresh the main notification list as well

        // Use a local variable for targetUser inside this closure
        // to ensure it's the value at the time the message is received.
        // This is a subtle point if targetUser changes while a message is in flight.
        // For simplicity, we'll use the state `targetUser` directly here,
        // but be mindful if you see issues with message routing to the active chat.
        if (targetUser && currentUser && // currentUser should be stable within this effect's scope
            ((receivedMessage.sender_id === currentUser.id && receivedMessage.receiver_id === targetUser.id) || // Current user sent to target
             (receivedMessage.sender_id === targetUser.id && receivedMessage.receiver_id === currentUser.id))) { // Target user sent to current user
          // Message is for the currently active chat window
          console.log('DM WS: Message for active chat. Current Target User ID:', targetUser?.id, 'Username:', targetUser?.username, 'Received From:', receivedMessage.sender_id, 'To:', receivedMessage.receiver_id);
          setMessages(prevMessages => [...prevMessages, receivedMessage]);
        } else if (currentUser && receivedMessage.receiver_id === currentUser.id) {
          // Message is for the current user, but not the active chat window
          const senderName = receivedMessage.sender.nickname || receivedMessage.sender.username;
          showToast(`New message from ${senderName}`, 'info');
          // Log details when a toast is shown, to debug why it wasn't considered an "active chat" message
          console.warn('DM WS: Toast shown for a message.');
          console.log('DM WS Details for Toast Event:');
          console.log('  - Target User at time of toast:', targetUser ? { id: targetUser.id, username: targetUser.username } : 'null');
          console.log('  - Current User at time of toast:', currentUser ? { id: currentUser.id, username: currentUser.username } : 'null');
          console.log('  - Received Message:', {
            id: receivedMessage.id,
            sender_id: receivedMessage.sender_id,
            sender_username: receivedMessage.sender.username,
            receiver_id: receivedMessage.receiver_id,
            receiver_username: receivedMessage.receiver.username,
            content_preview: receivedMessage.content.substring(0, 30) + "..."
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    newWs.onclose = () => {
      console.log('DM WebSocket Disconnected');
      ws.current = null; // Clear the ref on close
    };

    newWs.onerror = (error) => {
      console.error('DM WebSocket Error:', error);
      // ws.current might not be set yet if error happens before onopen
      // If newWs is ws.current, then setting ws.current to null in onclose is sufficient.
    };

    return () => {
      // Only try to close if ws.current exists and is in OPEN or CONNECTING state
      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
        ws.current.close();
      }
      ws.current = null; // Ensure ref is cleared on cleanup
    };
  }, [currentUser, targetUser, showToast, refreshNotificationsList]);

  // Fetch messages when targetUser changes
  useEffect(() => {
    if (targetUser && currentUser) {
      const fetchMessages = async () => {
        setLoadingMessages(true);
        setErrorMessages(null);
        setMessages([]); // Clear previous messages before fetching new ones
        const token = localStorage.getItem('accessToken');
        try {
          // Use the environment variable
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${targetUser.id}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to fetch messages.');
          }
          const data: DirectMessageSchema[] = await response.json();
          setMessages(data);
        } catch (err: any) {
          setErrorMessages(err.message);
        } finally {
          setLoadingMessages(false);
        }
      };
      fetchMessages();
    }
  }, [targetUser, currentUser]);

  // Effect for handling deep linking via ?targetUser= query parameter
  useEffect(() => {
    if (currentUser && searchParams) {
      const targetUsernameFromQuery = searchParams.get('targetUser');
      if (targetUsernameFromQuery && targetUsernameFromQuery !== targetUser?.username) {
        const fetchTargetUserFromQuery = async () => {
          setLoadingSearch(true);
          setErrorSearch(null);
          // setTargetUser(null); // Don't clear target user if it's already the one from query
          setMessages([]);
          const token = localStorage.getItem('accessToken');
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/search?username=${encodeURIComponent(targetUsernameFromQuery)}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.detail || 'User from query parameter not found.');
            }
            const foundUser: UserSchema = await response.json();
            if (foundUser.id !== currentUser.id) {
              setTargetUser(foundUser);
              setSearchedUsername(foundUser.username); // Optionally prefill search bar
            } else {
              setErrorSearch("You cannot message yourself via query parameter.");
            }
          } catch (err: any) {
            setErrorSearch(err.message);
          } finally {
            setLoadingSearch(false);
          }
        };
        fetchTargetUserFromQuery();
      }
    }
  }, [currentUser, searchParams, router, targetUser?.username]); // Add targetUser?.username to dependencies

  const handleSearchUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchedUsername.trim() || !currentUser) return;
    if (searchedUsername.trim().toLowerCase() === currentUser.username.toLowerCase()) {
        setErrorSearch("You cannot message yourself.");
        return;
    }

    setLoadingSearch(true);
    setErrorSearch(null);
    setTargetUser(null);
    setMessages([]);
    const token = localStorage.getItem('accessToken');

    try {
      // Use the environment variable
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/search?username=${encodeURIComponent(searchedUsername)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'User search failed.');
      }
      const foundUser: UserSchema = await response.json();
      setTargetUser(foundUser);
    } catch (err: any) {
      setErrorSearch(err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingMessage) return; // Prevent re-entrant calls
    if (!newMessageContent.trim() || !targetUser || !currentUser) return;

    setSendingMessage(true);
    setErrorSendingMessage(null);
    const token = localStorage.getItem('accessToken');
    try {
      // Use the environment variable
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${targetUser.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newMessageContent }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to send message.');
      }
      const sentMessage: DirectMessageSchema = await response.json();
      if (targetUser && sentMessage.receiver_id === targetUser.id) {
         setMessages(prevMessages => [...prevMessages, sentMessage]);
      }
      updateAndSortConversations(sentMessage);
      setNewMessageContent('');
      // setFocusInputAfterSend(true); // No longer needed

    } catch (err: any) {
      setErrorSendingMessage(err.message);
    } finally {
      setSendingMessage(false);
      // If focus was somehow lost despite not disabling, messageInputRef.current?.focus() could be tried here.
      // For now, assuming focus is retained.
    }
  };

  // // Effect to focus the message input after a message is sent (REMOVED as focus should be retained)
  // useEffect(() => {
  //   if (focusInputAfterSend && messageInputRef.current) {
  //     // ... focus logic ...
  //     setFocusInputAfterSend(false); 
  //   }
  // }, [focusInputAfterSend]);

  // Effect for global keydown listener to auto-focus inputs
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement;
      const isTypingInInput = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA';
      const isButtonFocused = targetElement.tagName === 'BUTTON' && (event.key === 'Enter' || event.key === ' ');

      // If already typing in an input/textarea, or a button is focused and Enter/Space is pressed, do nothing.
      if (isTypingInInput || isButtonFocused) {
        return;
      }

      // Check for actual character input (simplified: key length is 1, not a modifier key)
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        if (!targetUser && usernameSearchInputRef.current) {
          // Only focus if not already focused by this handler's previous run for the same event
          if (document.activeElement !== usernameSearchInputRef.current) {
            usernameSearchInputRef.current.focus();
          }
        } else if (targetUser && messageInputRef.current) {
          if (document.activeElement !== messageInputRef.current) {
            messageInputRef.current.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [targetUser]); // Re-evaluate if targetUser changes, to update behavior

  if (!currentUser) {
    return <div className="h-screen bg-gray-800 text-white flex items-center justify-center"><p>Loading user...</p></div>;
  }

  const handleSelectConversation = (conversation: ConversationSchema) => {
    setTargetUser(conversation.other_user);
    setSearchedUsername('');
    setErrorSearch(null);
  };

  return (
    <div className="h-screen bg-gray-800 text-white p-4 flex flex-col md:flex-row overflow-hidden custom-dm-scrollbar">
      {/* User Search & Conversation List Panel */}
      <div className="w-full md:w-1/3 lg:w-1/4 p-2 md:border-r border-gray-700 flex flex-col">
        <div className="mb-4">
            <Link href="/" className="text-indigo-400 hover:text-indigo-200 transition-colors">
                &larr; Back to Homepage
            </Link>
        </div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-indigo-400">Direct Messages</h2>
          {currentUser && <NotificationBell /> /* Show bell if user is loaded */}
        </div>
        <form onSubmit={handleSearchUser} className="mb-4">
          <input
            type="text"
            value={searchedUsername}
            onChange={(e) => { setSearchedUsername(e.target.value); setErrorSearch(null); }}
            placeholder="Enter username to chat"
            ref={usernameSearchInputRef} // Assign ref to username search input
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loadingSearch}
          />
          {errorSearch && <p className="text-red-400 text-xs mt-1">{errorSearch}</p>}
          <button type="submit" disabled={loadingSearch || !searchedUsername.trim()}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50">
            {loadingSearch ? 'Searching...' : 'Chat with User'}
          </button>
        </form>

        <h3 className="text-lg font-semibold mb-2 text-indigo-300 mt-4">Conversations</h3>
        <div className="flex-1 overflow-y-auto custom-dm-scrollbar pr-1">
          {loadingConversations && <p className="text-gray-400">Loading conversations...</p>}
          {errorConversations && <p className="text-red-400">{errorConversations}</p>}
          {!loadingConversations && conversations.length === 0 && <p className="text-gray-500">No active conversations.</p>}
          {!loadingConversations && conversations.map(convo => (
            <div
              key={convo.other_user.id}
              onClick={() => handleSelectConversation(convo)}
              className={`p-3 mb-2 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors
                          ${targetUser?.id === convo.other_user.id ? 'bg-gray-700 border-l-4 border-indigo-500' : 'bg-gray-750'}`} // bg-gray-750 might need to be defined or use bg-gray-600/800
            >
              <div className="flex items-center">
                <Link href={`/users/${convo.other_user.username}`} onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                  <img
                    src={getFullAvatarUrl(convo.other_user.avatar_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(convo.other_user.username)}&background=2A303C&color=CBD5E1`}
                    alt={`${convo.other_user.nickname || convo.other_user.username}'s avatar`}
                    className="w-10 h-10 rounded-full mr-3 object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0"> {/* Added min-w-0 for proper truncation */}
                  {/* Username is no longer a link here, only avatar is */}
                  <span className="font-semibold text-indigo-400 truncate block">
                    {convo.other_user.nickname || convo.other_user.username}
                  </span>
              {convo.last_message && (
                <>
                  <p className="text-sm text-gray-300 truncate">
                    {convo.last_message.sender_id === currentUser.id ? "You: " : ""}
                    {convo.last_message.content}
                  </p>
                </>
              )}
                </div>
              </div>
              {convo.last_message && (
                 <p className="text-xs text-gray-500 text-right mt-1">{new Date(convo.last_message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 p-2 flex flex-col">
        {!targetUser && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Search for a user or select a conversation to start chatting.</p>
          </div>
        )}
        {targetUser && (
          <>
            <div className="border-b border-gray-700 pb-2 mb-4">
              <Link href={`/users/${targetUser.username}`} className="text-lg font-semibold text-indigo-300 hover:underline">
                Chat with: {targetUser.nickname || targetUser.username}
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-2 custom-dm-scrollbar">
              {loadingMessages && <p>Loading messages...</p>}
              {errorMessages && <p className="text-red-400">{errorMessages}</p>}
              {!loadingMessages && messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-end max-w-xs lg:max-w-md ${msg.sender_id === currentUser.id ? 'flex-row-reverse' : ''}`}>
                    <Link href={`/users/${msg.sender.username}`} className="flex-shrink-0">
                      <img
                        src={getFullAvatarUrl(msg.sender.avatar_url) || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender.nickname || msg.sender.username)}&background=2A303C&color=CBD5E1`}
                        alt={`${msg.sender.nickname || msg.sender.username}'s avatar`}
                        className={`w-8 h-8 rounded-full object-cover ${msg.sender_id === currentUser.id ? 'ml-2' : 'mr-2'}`}
                      />
                    </Link>
                    <div className={`p-3 rounded-lg ${msg.sender_id === currentUser.id ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                      {msg.sender_id !== currentUser.id && (
                        <Link href={`/users/${msg.sender.username}`} className="text-sm font-semibold mb-0.5 text-indigo-300 hover:underline">
                          {msg.sender.nickname || msg.sender.username}
                        </Link>
                      )}
                      <div className="text-white text-sm prose prose-sm prose-invert max-w-none break-words"> {/* Added break-words */}
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="mt-auto">
              {errorSendingMessage && <p className="text-red-400 text-xs mb-1">{errorSendingMessage}</p>}
              <div className="flex">
                <input
                  type="text"
                  value={newMessageContent}
                  onChange={(e) => {
                    if (!sendingMessage) { // Only allow changes if not currently sending
                      setNewMessageContent(e.target.value);
                    }
                  }}
                  placeholder="Type your message..."
                  ref={messageInputRef} // Assign the ref to the input
                  className="flex-1 p-2 rounded-l bg-gray-700 border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                  // disabled={sendingMessage} // Removed: Input is no longer disabled
                />
                <button type="submit" disabled={sendingMessage || !newMessageContent.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold p-2 rounded-r disabled:opacity-50">
                  {sendingMessage ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
