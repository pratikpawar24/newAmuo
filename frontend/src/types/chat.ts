export interface ChatMessage {
  _id: string;
  chatRoomId: string;
  sender: string | { _id: string; fullName: string; avatarUrl?: string };
  content: string;
  messageType: 'text' | 'system' | 'price_offer' | 'location';
  priceOffer?: {
    amount: number;
    status: 'pending' | 'accepted' | 'rejected';
  };
  readBy: string[];
  createdAt: string;
}

export interface ChatRoom {
  roomId: string;
  rideId: string;
  rideName: string;
  rideStatus: string;
  lastMessage?: { content: string; createdAt: string; messageType: string };
  unreadCount: number;
  participants: Array<{ _id: string; fullName: string; avatarUrl?: string } | string>;
}
