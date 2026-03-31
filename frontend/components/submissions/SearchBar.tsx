
import { useEffect, useRef } from 'react';


interface SearchBarProps {
  value:    string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);


  return (
    <div
      className="relative group w-full"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Outer glow ring on focus */}
      <div className="
        absolute -inset-0.5 rounded-2xl
        bg-gradient-to-r from-blue-500 to-blue-400
        opacity-0 group-focus-within:opacity-100
        blur-sm transition-opacity duration-300
      " />

      <div className="relative flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Icon */}
        <div className="pl-5 pr-3 flex items-center shrink-0">
          <svg
            className="transition-colors duration-200 group-focus-within:text-blue-600 text-gray-400"
            width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Search submissions by title or keyword..."

          aria-label="Search submissions"

          className="
            flex-1 py-4 pr-5 bg-transparent outline-none
            text-gray-800 text-[0.9375rem] placeholder-gray-400
            font-medium
          "
        />

        {/* Clear button */}
        {value && (
          <button
            onClick={() => onChange('')}
            className="
              mr-4 w-6 h-6 rounded-full
              bg-gray-100 hover:bg-gray-200
              flex items-center justify-center
              transition-colors duration-150
              shrink-0
            "
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="#6b7280">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        )}

        {/* Keyboard shortcut hint */}
        {!value && (
          <div className="mr-4 hidden sm:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[0.625rem] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded">
              /
            </kbd>
          </div>
        )}
      </div>
    </div>
  );
}