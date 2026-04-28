'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type SearchBarProps = {
  placeholder?: string;
  value: string;
  id: string;
  name: string;
  onChange: (value: string) => void;
  className?: string;
  inputTestId?: string;
};

export function SearchBar({
  placeholder = 'Search...',
  value,
  id,
  name,
  onChange,
  className = '',
  inputTestId,
}: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        id={id}
        name={name}
        data-testid={inputTestId}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-10"
        type="search"
      />
    </div>
  );
}
