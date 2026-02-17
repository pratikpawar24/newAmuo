'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import PriceNegotiation from './PriceNegotiation';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';

interface ChatWindowProps {
  chatRoomId: string;
}

export default function ChatWindow({ chatRoomId }: ChatWindowProps) {
  const { user } = useAuth();
  const { messages, hasMore, isLoading, typingUsers, sendMessage, sendTyping, sendPriceOffer, loadMore } = useChat(chatRoomId);
  const [text, setText] = useState('');
  const [showPriceModal, setShowPriceModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text.trim());
    setText('');
    sendTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    sendTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 2000);
  };

  const activeTypers = Object.entries(typingUsers).filter(([id, t]) => t.isTyping && id !== user?._id);

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {hasMore && (
          <div className="mb-4 text-center">
            <Button variant="ghost" size="sm" onClick={loadMore} isLoading={isLoading}>
              Load older messages
            </Button>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg._id}
            message={msg}
            isOwn={(typeof msg.sender === 'object' ? msg.sender._id : msg.sender) === user?._id}
          />
        ))}
        {activeTypers.length > 0 && <TypingIndicator names={activeTypers.map(([, t]) => t.userName)} />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowPriceModal(true)}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary-500 dark:hover:bg-slate-700"
            title="Price offer"
          >
            💰
          </button>
          <textarea
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="input-field max-h-24 min-h-[40px] resize-none"
          />
          <Button onClick={handleSend} disabled={!text.trim()} size="sm">
            Send
          </Button>
        </div>
      </div>

      {showPriceModal && (
        <PriceNegotiation
          isOpen={showPriceModal}
          onClose={() => setShowPriceModal(false)}
          onSubmit={(amount: number) => {
            sendPriceOffer(amount);
            setShowPriceModal(false);
          }}
        />
      )}
    </div>
  );
}
