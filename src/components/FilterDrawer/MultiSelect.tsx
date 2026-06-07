import { useState, useRef, useEffect } from 'react';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ label, options, selected, onChange, placeholder = 'Search…' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  return (
    <div className="ms-root" ref={containerRef}>
      <span className="ms-label">{label}</span>
      <button
        className={`ms-trigger${selected.length > 0 ? ' ms-trigger--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="ms-trigger__text">{triggerLabel}</span>
        <span className="ms-trigger__arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="ms-dropdown">
          <input
            className="ms-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            autoFocus
          />
          <div className="ms-list">
            {filtered.length === 0 && <div className="ms-empty">No results</div>}
            {filtered.map((opt) => (
              <label key={opt} className="ms-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <button className="ms-clear" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
