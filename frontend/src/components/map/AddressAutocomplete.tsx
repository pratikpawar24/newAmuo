'use client';

import { useState, useCallback } from 'react';
import { autocomplete } from '@/lib/nominatim';
import Input from '@/components/ui/Input';

interface AddressResult {
  display_name: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  label: string;
  placeholder?: string;
  onSelect: (result: AddressResult) => void;
  value?: string;
}

export default function AddressAutocomplete({ label, placeholder, onSelect, value }: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      autocomplete(val, (r) => {
        setResults(r);
        setIsOpen(r.length > 0);
      });
    },
    []
  );

  const handleSelect = (result: AddressResult) => {
    setQuery(result.display_name.split(',').slice(0, 2).join(', '));
    setIsOpen(false);
    onSelect(result);
  };

  return (
    <div className="relative">
      <Input
        label={label}
        placeholder={placeholder || 'Search for an address...'}
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <p className="font-medium">{r.display_name.split(',').slice(0, 2).join(', ')}</p>
                <p className="text-xs text-slate-400">{r.display_name}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
