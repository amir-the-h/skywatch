import { useState } from 'react';
import { useFilterStore, isFilterActive, DEFAULT_ALT_MIN, DEFAULT_ALT_MAX } from '../../store/filterStore';
import type { FlightPhase } from '../../lib/flightPhase';

const ALL_PHASES: FlightPhase[] = ['TXI', 'GND', 'T/O', 'APP', 'CLB', 'DSC', 'CRZ'];

export function FilterDrawer() {
  const [open, setOpen] = useState(false);
  const filters = useFilterStore();
  const active = isFilterActive(filters);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.callsign) {
    chips.push({ key: 'callsign', label: filters.callsign, clear: () => filters.setCallsign('') });
  }
  if (filters.manufacturer) {
    chips.push({ key: 'mfr', label: `mfr:${filters.manufacturer}`, clear: () => filters.setManufacturer('') });
  }
  if (filters.model) {
    chips.push({ key: 'model', label: `mdl:${filters.model}`, clear: () => filters.setModel('') });
  }
  if (filters.altMin > DEFAULT_ALT_MIN || filters.altMax < DEFAULT_ALT_MAX) {
    chips.push({
      key: 'alt',
      label: `${filters.altMin.toLocaleString()}–${filters.altMax.toLocaleString()} ft`,
      clear: () => filters.setAltRange(DEFAULT_ALT_MIN, DEFAULT_ALT_MAX),
    });
  }
  for (const p of filters.phases) {
    chips.push({ key: `phase-${p}`, label: p, clear: () => filters.setPhases(filters.phases.filter((x) => x !== p)) });
  }

  return (
    <div className="filter-drawer">
      <div className="filter-drawer__bar">
        <button
          className={`filter-toggle${active ? ' filter-toggle--active' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          ⊟ Filters{active && <span className="filter-badge">{chips.length}</span>}
        </button>

        {active && !open && (
          <div className="filter-chips">
            {chips.map((c) => (
              <button key={c.key} className="filter-chip" onClick={c.clear}>
                {c.label} ×
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="filter-panel">
          <div className="filter-row">
            <label className="filter-field">
              <span>Callsign / Flight</span>
              <input
                type="text"
                value={filters.callsign}
                onChange={(e) => filters.setCallsign(e.target.value)}
                placeholder="e.g. UAL"
              />
            </label>
            <label className="filter-field">
              <span>Manufacturer</span>
              <input
                type="text"
                value={filters.manufacturer}
                onChange={(e) => filters.setManufacturer(e.target.value)}
                placeholder="e.g. Boeing"
              />
            </label>
            <label className="filter-field">
              <span>Model</span>
              <input
                type="text"
                value={filters.model}
                onChange={(e) => filters.setModel(e.target.value)}
                placeholder="e.g. B738"
              />
            </label>
          </div>

          <div className="filter-row">
            <label className="filter-field">
              <span>Min altitude (ft)</span>
              <input
                type="number"
                min={0}
                max={60000}
                step={500}
                value={filters.altMin}
                onChange={(e) => filters.setAltRange(Math.max(0, parseInt(e.target.value) || 0), filters.altMax)}
              />
            </label>
            <label className="filter-field">
              <span>Max altitude (ft)</span>
              <input
                type="number"
                min={0}
                max={60000}
                step={500}
                value={filters.altMax}
                onChange={(e) => filters.setAltRange(filters.altMin, Math.min(60000, parseInt(e.target.value) || 60000))}
              />
            </label>
          </div>

          <div className="filter-phases">
            <span className="filter-phases__label">Phase</span>
            {ALL_PHASES.map((p) => (
              <button
                key={p}
                className={`phase-toggle${filters.phases.includes(p) ? ' phase-toggle--active' : ''}`}
                onClick={() =>
                  filters.setPhases(
                    filters.phases.includes(p)
                      ? filters.phases.filter((x) => x !== p)
                      : [...filters.phases, p]
                  )
                }
              >
                {p}
              </button>
            ))}
          </div>

          {active && (
            <button className="filter-clear" onClick={filters.reset}>
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
