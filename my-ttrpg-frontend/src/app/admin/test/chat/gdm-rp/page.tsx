// src/app/admin/test/chat/gdm-rp/page.tsx
'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { NotificationBell } from '@/components/notifications/NotificationBell';

type MessageSenderType = 'gm' | 'character' | 'system' | 'narration' | 'action';

interface MessageSegment {
  type: 'action' | 'dialogue';
  text: string;
}

interface MockMessage {
  id: string;
  senderName: string;
  senderType: MessageSenderType;
  content: string;
  timestamp: string;
  segments?: MessageSegment[];
  avatar?: string;
  character_id?: string; // For linking avatar
  owner_user_id?: string; // For linking avatar (user_id of the character's owner)
}

const MAX_HORIZONTAL_BUBBLES_IN_SEQUENCE = 3;
const MAX_CONTENT_LENGTH_FOR_HORIZONTAL_BUBBLE = 60;

const COMMON_DICE = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100'];
interface UserRoleplayCharacter {
  id: number;
  user_id: number; // This is the owner's ID
  name: string;
  profile_photo_filename?: string | null;
  // Add other fields if needed, like nickname, etc.
}

const RP_TEST_CHANNEL_ID = "gdm-rp-test-channel";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function GdmRpTestPage() {
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null); // Stores the ID of the selected character
  const [userCharacters, setUserCharacters] = useState<UserRoleplayCharacter[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);
  const [worldInfo, setWorldInfo] = useState<string | null>(null);
  const [mockMessages, setMockMessages] = useState<MockMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendAsType, setSendAsType] = useState<MessageSenderType>('character');
  const [diceInput, setDiceInput] = useState<string>('1d20');
  const [lastRollResult, setLastRollResult] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const getCharacterImageUrl = (ownerUserId: string | number, filename: string | null | undefined): string | undefined => {
    if (!filename || !ownerUserId) return undefined;
    return `${API_BASE_URL}/api/characters/images/${ownerUserId}/${filename}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchInitialMessages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rp-chat/${RP_TEST_CHANNEL_ID}/messages?limit=100`);
        if (!response.ok) {
          throw new Error('Failed to fetch initial messages');
        }
        const data: MockMessage[] = await response.json();
        setMockMessages(data);
      } catch (error) {
        console.error("Error fetching initial messages:", error);
      }
    };

    const fetchUserCharacters = async () => {
      setIsLoadingCharacters(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoadingCharacters(false);
        // Handle not logged in? For a test page, maybe it's fine.
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/api/characters/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch user characters');
        const data: UserRoleplayCharacter[] = await response.json();
        setUserCharacters(data);
        setIsLoadingCharacters(false); // Set loading to false on success
      } catch (error) {
        console.error("Error fetching user characters:", error);
        setIsLoadingCharacters(false); // Set loading to false on error
      }
    };
    fetchInitialMessages();
    fetchUserCharacters(); // Fetch characters on component mount

    const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBaseUrl}/api/rp-chat/ws/${RP_TEST_CHANNEL_ID}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("RP Chat WebSocket Connected");
    };

    ws.onmessage = (event) => {
      try {
        const receivedMessage: MockMessage = JSON.parse(event.data as string);
        console.log('WebSocket receivedMessage:', receivedMessage); // Log the received message
        setMockMessages(prevMessages => [...prevMessages, receivedMessage]);
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log("RP Chat WebSocket Disconnected");
    };

    ws.onerror = (error) => {
      console.error("RP Chat WebSocket Error:", error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, []);

  useEffect(scrollToBottom, [mockMessages]);

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleSendMessage called. newMessage:', newMessage, 'sendAsType:', sendAsType, 'activeCharacterId:', activeCharacterId);
    if (!newMessage.trim()) return;

    let senderNameForPayload: string = 'Game Master'; // Default
    let avatarForPayload: string | undefined = undefined;
    let characterIdForPayload: string | undefined = undefined;
    let ownerUserIdForPayload: string | undefined = undefined;

    const selectedCharacter = userCharacters.find(char => char.id.toString() === activeCharacterId);

    if ((sendAsType === 'character' || sendAsType === 'action') && selectedCharacter) {
      senderNameForPayload = selectedCharacter.name;
      avatarForPayload = getCharacterImageUrl(selectedCharacter.user_id, selectedCharacter.profile_photo_filename);
      characterIdForPayload = selectedCharacter.id.toString();
      ownerUserIdForPayload = selectedCharacter.user_id.toString();
    } else if (sendAsType === 'gm') {
      senderNameForPayload = 'Game Master';
    } else if (sendAsType === 'narration') {
      senderNameForPayload = 'Narrator';
    } else if (sendAsType === 'system') {
      senderNameForPayload = 'System';
    }

    if (sendAsType === 'character' && newMessage.includes('*')) {
      const parts = newMessage.split('*');
      for (const [index, part] of parts.entries()) {
        if (part.trim() === '') continue;
        const isActionSegment = index % 2 !== 0;
        await postMessageToBackend({
          senderName: senderNameForPayload, // Character's name
          senderType: isActionSegment ? 'action' : 'character',
          content: part.trim(),
          avatar: avatarForPayload,
          character_id: characterIdForPayload,
          owner_user_id: ownerUserIdForPayload,
        });
      }
    } else {
      // This block handles single messages or types other than multi-part character messages.
      // The senderNameForPayload and avatarForPayload are already set correctly above.
      await postMessageToBackend({
        senderName: senderNameForPayload,
        senderType: sendAsType,
        content: newMessage.trim(),
        avatar: avatarForPayload,
        character_id: characterIdForPayload,
        owner_user_id: ownerUserIdForPayload,
      });
    }
    setNewMessage('');
  };

  // Update payload type for postMessageToBackend
  const postMessageToBackend = async (payload: Omit<MockMessage, 'id' | 'timestamp' | 'segments'>) => {
    try {
      console.log('postMessageToBackend called with payload:', payload, 'API URL:', `${API_BASE_URL}/api/rp-chat/${RP_TEST_CHANNEL_ID}/messages`);
      const response = await fetch(`${API_BASE_URL}/api/rp-chat/${RP_TEST_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to send message. Status:", response.status, "Error data:", errorData.detail || response.statusText);
        // Optionally, you could set an error state here to display to the user
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally, display this error to the user
    }
  };

  const handleDiceRoll = async (notationOverride?: string) => {
    const notationToRoll = notationOverride || diceInput;
    const selectedChar = userCharacters.find(c => c.id.toString() === activeCharacterId);
    const rollerName = selectedChar ? selectedChar.name : (sendAsType === 'gm' ? 'Game Master' : 'Someone');

    try {
      const response = await fetch(`${API_BASE_URL}/api/rp-chat/${RP_TEST_CHANNEL_ID}/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notation: notationToRoll, rollerName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to send dice roll:", errorData.detail || response.statusText);
        setLastRollResult(`Error rolling: ${errorData.detail || 'Invalid notation'}`);
        return;
      }
      setLastRollResult(`Roll sent: ${notationToRoll} by ${rollerName}. Result will appear in chat.`);
    } catch (error) {
      console.error("Error sending dice roll:", error);
      setLastRollResult(`Invalid dice notation: "${notationToRoll}"`);
    }
  };

  const handleQuickDieRoll = (die: string) => {
    setDiceInput(die);
    handleDiceRoll(die);
  };

  // Move the grouping logic here, before return
  const groupedMessages = (() => {
    const grouped: (MockMessage | MockMessage[])[] = [];
    let currentSequence: MockMessage[] = [];

    mockMessages.forEach((msg, index) => {
      const isCharacterOrAction = msg.senderType === 'character' || msg.senderType === 'action';
      const prevMsg = mockMessages[index - 1];
      const isContinuingSequence =
        prevMsg &&
        prevMsg.senderName === msg.senderName &&
        (prevMsg.senderType === 'character' || prevMsg.senderType === 'action') &&
        isCharacterOrAction &&
        (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 1000);

      if (isCharacterOrAction) {
        if (isContinuingSequence) {
          currentSequence.push(msg);
        } else {
          if (currentSequence.length > 0) {
            grouped.push([...currentSequence]);
          }
          currentSequence = [msg];
        }
      } else {
        if (currentSequence.length > 0) {
          grouped.push([...currentSequence]);
          currentSequence = [];
        }
        grouped.push(msg);
      }
    });
    if (currentSequence.length > 0) {
      grouped.push([...currentSequence]);
    }
    return grouped;
  })();

  return (
    <div className="h-screen bg-gray-800 text-white p-4 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar Panel */}
      <div className="w-full md:w-1/3 lg:w-1/4 p-2 md:border-r border-gray-700 flex flex-col space-y-4">
        <div>
          <Link href="/admin" className="text-indigo-400 hover:text-indigo-200 transition-colors">
            &larr; Back to Admin (Placeholder)
          </Link>
        </div>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-indigo-400">RP Test Controls</h2>
          <NotificationBell />
        </div>
        
        <div className="p-3 bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-indigo-300 mb-2">Active Character</h3>
          <select
            value={activeCharacterId || ''}
            onChange={(e) => setActiveCharacterId(e.target.value || null)}
            className="w-full p-2 bg-gray-600 rounded text-sm"
            disabled={isLoadingCharacters}
          >
            <option value="">{isLoadingCharacters ? "Loading chars..." : "Select Character"}</option>
            {userCharacters.map(char => (
              <option key={char.id} value={char.id.toString()}>
                {char.name}
              </option>
            ))}
             {!isLoadingCharacters && userCharacters.length === 0 && (
              <option value="" disabled>No characters found</option>
            )}
          </select>
          <h3 className="font-semibold text-indigo-300 mb-1 mt-2">Send As Type</h3>
          <select
            value={sendAsType}
            onChange={(e) => setSendAsType(e.target.value as MessageSenderType)}
            className="w-full p-2 bg-gray-600 rounded text-sm"
          >
            <option value="character">Character</option>
            <option value="gm">Game Master</option>
            <option value="narration">Narration</option>
            <option value="action">Action</option>
            <option value="system">System (Dice Roll)</option>
          </select>
        </div>

        <div className="p-3 bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-indigo-300 mb-2">World Lore</h3>
          <p className="text-sm text-gray-400">{worldInfo || "World details..."}</p>
        </div>

        <div className="p-3 bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-indigo-300 mb-2">Dice Roller</h3>
          <div className="flex space-x-2">
            <input
              type="text"
              value={diceInput}
              onChange={(e) => setDiceInput(e.target.value)}
              placeholder="e.g., 2d6+3"
              className="flex-1 p-2 bg-gray-600 rounded text-sm border border-gray-500 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={() => handleDiceRoll()}
              className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm font-semibold"
            >
              Roll
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COMMON_DICE.map(die => (
              <button
                key={die}
                onClick={() => handleQuickDieRoll(die)}
                className="px-2.5 py-1 bg-gray-500 hover:bg-gray-400 text-white text-xs rounded"
              >
                {die.substring(1)}
              </button>
            ))}
          </div>
          {lastRollResult && <p className="text-xs text-gray-300 mt-2 bg-gray-500 p-1.5 rounded">{lastRollResult}</p>}
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 p-2 flex flex-col">
        <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 custom-dm-scrollbar">
          {groupedMessages.map((group, groupIndex) => {
            if (Array.isArray(group)) {
              const firstMsgInSequence = group[0];
              const isSenderActiveCharacter = activeCharacterId && userCharacters.find(c => c.id.toString() === activeCharacterId)?.name === firstMsgInSequence.senderName;
              const alignment = isSenderActiveCharacter ? 'justify-end' : 'justify-start';
              let showAvatarForThisGroup = true;

              if (groupIndex > 0) {
                const prevGroup = groupedMessages[groupIndex - 1];
                const prevGroupSenderName = Array.isArray(prevGroup) ? prevGroup[0].senderName : prevGroup.senderName;
                const prevGroupIsCharOrAction = Array.isArray(prevGroup) ?
                  (prevGroup[0].senderType === 'character' || prevGroup[0].senderType === 'action') :
                  (prevGroup.senderType === 'character' || prevGroup.senderType === 'action');

                if (prevGroupIsCharOrAction && firstMsgInSequence.senderName === prevGroupSenderName) {
                  showAvatarForThisGroup = false;
                }
              }

              const shouldStackVertically =
                group.length > MAX_HORIZONTAL_BUBBLES_IN_SEQUENCE ||
                group.some(msg => msg.content.length > MAX_CONTENT_LENGTH_FOR_HORIZONTAL_BUBBLE);

              return (
                <div key={`seq-${groupIndex}`} className={`flex ${alignment} w-full`}>
                  <div className={`flex items-end ${isSenderActiveCharacter ? 'flex-row-reverse' : 'flex-row'} ${!showAvatarForThisGroup && isSenderActiveCharacter ? 'mr-[calc(2rem+0.5rem)]' : ''} ${!showAvatarForThisGroup && !isSenderActiveCharacter ? 'ml-[calc(2rem+0.5rem)]' : ''}`}>
                    {firstMsgInSequence.avatar && showAvatarForThisGroup && (
                       firstMsgInSequence.owner_user_id && firstMsgInSequence.character_id ? (
                        <Link href={`/view/${firstMsgInSequence.owner_user_id}/${firstMsgInSequence.character_id}`}>
                          <img
                            src={firstMsgInSequence.avatar}
                            alt={`${firstMsgInSequence.senderName}'s avatar`}
                            className={`w-8 h-8 rounded-full object-cover self-end ${isSenderActiveCharacter ? 'ml-2' : 'mr-2'}`}
                          />
                        </Link>
                       ) : ( <img
                        src={firstMsgInSequence.avatar}
                        alt={`${firstMsgInSequence.senderName}'s avatar`}
                        className={`w-8 h-8 rounded-full object-cover self-end ${isSenderActiveCharacter ? 'ml-2' : 'mr-2'}`}
                      />)
                    )}
                      <div className={`flex ${shouldStackVertically ? 'flex-col items-stretch' : 'flex-row flex-wrap items-end'}`}>
                        {group.map(msg => (
                          <div key={msg.id} className={`p-2.5 rounded-lg shadow-md m-0.5 
                            ${shouldStackVertically ? 'w-full my-1' : 'max-w-xs'}
                            ${msg.senderType === 'character' ? (isSenderActiveCharacter ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-100') : ''}
                            ${msg.senderType === 'action' ? 'bg-orange-600 text-orange-50 text-sm italic' : ''}
                          `}>
                            {msg.senderType === 'action' && (
                              <span className="text-xs font-semibold text-orange-200 block">ACTION! - {msg.senderName} -</span>
                            )}
                            {msg.senderType === 'character' && (
                               <p className={`text-xs font-semibold mb-0.5 ${isSenderActiveCharacter ? 'text-indigo-200' : 'text-indigo-300'}`}>{msg.senderName}</p>
                            )}
                            <div className={`text-sm break-words whitespace-pre-wrap ${msg.senderType === 'action' ? 'italic' : ''}`}>{msg.content}</div>
                            <p className={`text-xs mt-1 text-right ${msg.senderType === 'action' ? 'text-orange-300' : (isSenderActiveCharacter ? 'text-indigo-300' : 'text-gray-400')}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              } else { 
                const msg = group as MockMessage;
                let singleMessageAlignment = 'justify-center';
                let isSingleMsgFromActiveCharacter = false;
                let showAvatarForSingle = false;
                let showAvatarForThisGroup = true;

                if ((msg.senderType === 'character' || msg.senderType === 'action') && activeCharacterId) {
                  isSingleMsgFromActiveCharacter = userCharacters.find(c => c.id.toString() === activeCharacterId)?.name === msg.senderName;
                  singleMessageAlignment = isSingleMsgFromActiveCharacter ? 'justify-end' : 'justify-start';
                  showAvatarForSingle = !!msg.avatar;

                  if (groupIndex > 0) {
                    const prevGroup = groupedMessages[groupIndex - 1];
                    const prevGroupSenderName = Array.isArray(prevGroup) ? prevGroup[0].senderName : prevGroup.senderName;
                    const prevGroupIsCharOrAction = Array.isArray(prevGroup) ?
                      (prevGroup[0].senderType === 'character' || prevGroup[0].senderType === 'action') : // Corrected typo here
                      (prevGroup.senderType === 'character' || prevGroup.senderType === 'action');

                    if (prevGroupIsCharOrAction && msg.senderName === prevGroupSenderName) {
                      showAvatarForThisGroup = false;
                    }
                  }
                }

                return (
                  <div key={msg.id} className={`flex ${singleMessageAlignment} w-full`}>
                    <div
                      className={
                        `flex items-end ` +
                        `${isSingleMsgFromActiveCharacter && (msg.senderType === 'character' || msg.senderType === 'action') ? 'flex-row-reverse' : 'flex-row'} ` +
                        `${!showAvatarForThisGroup && showAvatarForSingle && isSingleMsgFromActiveCharacter ? 'mr-[calc(2rem+0.5rem)]' : ''} ` +
                        `${!showAvatarForThisGroup && showAvatarForSingle && !isSingleMsgFromActiveCharacter ? 'ml-[calc(2rem+0.5rem)]' : ''} ` +
                        `${msg.senderType === 'gm' ? 'w-full' : ''} ` +
                        `${msg.senderType === 'system' ? 'max-w-md' : ''} ` +
                        `${msg.senderType === 'narration' ? 'max-w-lg' : ''} ` +
                        `${(msg.senderType === 'character' || msg.senderType === 'action') ? 'max-w-xl' : ''}`
                      }
                    >
                      {showAvatarForSingle && msg.avatar && showAvatarForThisGroup && ( // Avatar for single character/action messages
                        msg.owner_user_id && msg.character_id ? (
                          <Link href={`/view/${msg.owner_user_id}/${msg.character_id}`}>
                            <img
                              src={msg.avatar}
                              alt={`${msg.senderName}'s avatar`}
                              className={`w-8 h-8 rounded-full object-cover self-end ${isSingleMsgFromActiveCharacter ? 'ml-2' : 'mr-2'}`}
                            />
                          </Link>
                        ) : ( <img
                            src={msg.avatar}
                            alt={`${msg.senderName}'s avatar`}
                            className={`w-8 h-8 rounded-full object-cover self-end ${isSingleMsgFromActiveCharacter ? 'ml-2' : 'mr-2'}`}
                          />)
                      )}
                      <div className={
                        `p-2.5 rounded-lg shadow-md ` +
                        `${msg.senderType === 'gm' ? 'bg-gray-700 text-gray-100 w-full border-l-4 border-purple-500' : ''} ` +
                        `${msg.senderType === 'character' ? (isSingleMsgFromActiveCharacter ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-100') : ''} ` +
                        `${msg.senderType === 'system' ? 'bg-yellow-700 text-yellow-100 text-sm italic text-center' : ''} ` +
                        `${msg.senderType === 'narration' ? 'bg-cyan-700 text-cyan-50 text-sm italic text-center' : ''} ` +
                        `${msg.senderType === 'action' ? 'bg-orange-600 text-orange-50 text-sm italic' : ''} ` +
                        `${(msg.senderType === 'character' || msg.senderType === 'action') ? 'min-w-[80px]' : ''}`
                      }>
                        {(msg.senderType === 'gm' || msg.senderType === 'character') && (
                          <p className={`text-xs font-semibold mb-0.5 
                            ${msg.senderType === 'gm' ? 'text-purple-300' : ''}
                            ${msg.senderType === 'character' ? (isSingleMsgFromActiveCharacter ? 'text-indigo-200' : 'text-indigo-300') : ''}
                          `}>
                            {msg.senderName}
                          </p>
                        )}
                        {msg.senderType === 'action' && (
                          <span className="text-xs font-semibold text-orange-200 block">ACTION! - {msg.senderName} -</span>
                        )}
                        <div className={`text-sm break-words whitespace-pre-wrap ${msg.senderType === 'action' ? 'italic' : ''}`}>{msg.content}</div>
                        <p className={
                          `text-xs mt-1 text-right ` +
                          `${msg.senderType === 'gm' ? 'text-slate-400' : ''} ` +
                          `${msg.senderType === 'character' ? (isSingleMsgFromActiveCharacter ? 'text-indigo-300' : 'text-gray-400') : ''} ` +
                          `${msg.senderType === 'system' ? 'text-yellow-400' : ''} ` +
                          `${msg.senderType === 'narration' ? 'text-cyan-400' : ''} ` +
                          `${msg.senderType === 'action' ? 'text-orange-300' : ''}`
                        }>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="mt-auto">
          <div className="flex">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your roleplay message or action..."
              className="flex-1 p-3 rounded-l bg-gray-700 border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 text-white"
            />
            <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold p-3 rounded-r">
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
