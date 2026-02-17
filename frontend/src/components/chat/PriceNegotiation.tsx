'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface PriceNegotiationProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}

export default function PriceNegotiation({ isOpen, onClose, onSubmit }: PriceNegotiationProps) {
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    onSubmit(num);
    setAmount('');
  };

  const presets = [50, 100, 150, 200, 300, 500];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💰 Make a Price Offer" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Enter an amount to propose for this ride.</p>
        <Input
          type="number"
          label="Amount (₹)"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 dark:border-slate-600 dark:text-slate-300"
            >
              ₹{p}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!amount || parseFloat(amount) <= 0} className="flex-1">
            Send Offer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
