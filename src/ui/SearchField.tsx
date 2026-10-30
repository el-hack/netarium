import { useRef } from 'react';
import { Search, X } from 'lucide-react';

export function SearchField({
  value,
  onChange,
  label,
  placeholder = label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="search-field">
      <Search size={16} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="clear-search"
          aria-label="Effacer la recherche"
          title="Effacer la recherche"
          onClick={() => {
            onChange('');
            input.current?.focus();
          }}
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
