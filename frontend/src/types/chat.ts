export interface ChatMessage {
  _id: string;
  chatRoomId: string;
  sender: string | { _id: string; name: string; avatar?: string };
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
  chatRoomId: string;
  ride: {
    _id: string;
    origin: { address: string };
    destination: { address: string };
  };
  otherUser: {
    _id: string;
    name: string;
    avatar?: string;
  };
  lastMessage?: ChatMessage;
  unreadCount: number;
}
