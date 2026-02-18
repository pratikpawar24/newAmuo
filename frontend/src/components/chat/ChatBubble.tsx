'use client';

import { cn, getInitials } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

export default function ChatBubble({ message, isOwn }: ChatBubbleProps) {
  const sender = typeof message.sender === 'object' ? message.sender : null;

  // Price offer card
  if (message.messageType === 'price_offer' && message.priceOffer) {
    return (
      <div className={cn('mb-3 flex', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="w-64 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="bg-gradient-to-r from-primary-500 to-accent-500 px-4 py-2 text-center text-xs font-semibold text-white">
            💰 Price Offer
          </div>
          <div className="bg-white p-4 text-center dark:bg-slate-800">
            <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{message.priceOffer.amount}</p>
            <p className="mt-1 text-xs text-slate-500">
              from {isOwn ? 'you' : sender?.fullName || 'user'}
            </p>
            <span
              className={cn(
                'mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold',
                message.priceOffer.status === 'accepted' && 'bg-green-100 text-green-700',
                message.priceOffer.status === 'rejected' && 'bg-red-100 text-red-700',
                message.priceOffer.status === 'pending' && 'bg-yellow-100 text-yellow-700'
              )}
            >
              {message.priceOffer.status}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // System message
  if (message.messageType === 'system') {
    return (
      <div className="mb-2 text-center">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
          {message.content}
        </span>
      </div>
    );
  }

  // Normal text message
  return (
    <div className={cn('mb-3 flex items-end gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {!isOwn && (
        sender?.avatarUrl ? (
          <img src={sender.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold dark:bg-slate-600">
            {getInitials(sender?.fullName || 'U')}
          </div>
        )
      )}
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2.5 text-sm',
          isOwn
            ? 'rounded-br-md bg-primary-500 text-white'
            : 'rounded-bl-md bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white'
        )}
      >
        {!isOwn && sender && (
          <p className="mb-0.5 text-[10px] font-semibold text-primary-600 dark:text-primary-400">{sender.fullName}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className={cn('mt-1 text-[10px]', isOwn ? 'text-white/60' : 'text-slate-400')}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
