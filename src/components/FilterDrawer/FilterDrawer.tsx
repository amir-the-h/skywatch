import { useMemo, useState } from 'react';
import { useFilterStore, isFilterActive, DEFAULT_ALT_MIN, DEFAULT_ALT_MAX } from '../../store/filterStore';
import { useAircraftStore } from '../../store/aircraftStore';
import { MultiSelect } from './MultiSelect';
import type { FlightPhase } from '../../lib/flightPhase';

const ALL_PHASES: FlightPhase[] = ['TXI', 'GND', 'T/O', 'APP', 'CLB', 'DSC', 'CRZ'];

export function FilterDrawer() {
  const [open, setOpen] = useState(false);
  const filters = useFilterStore();
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const active = isFilterActive(filters);

  const callsignOptions = useMemo(() =>
    [...new Set([...aircraftMap.values()].map((ac) => ac.flight ?? '').filter(Boolean))].sort(),
    [aircraftMap]
  );
  const manufacturerOptions = useMemo(() =>
    [...new Set([...aircraftMap.values()].map((ac) => ac.desc ?? '').filter(Boolean))].sort(),
    [aircraftMap]
  );
  const modelOptions = useMemo(() =>
    [...new Set([...aircraftMap.values()].map((ac) => ac.t ?? '').filter(Boolean))].sort(),
    [aircraftMap]
  );

  const chips: { key: string; label: string; clear: () => void }[] = [];
  for (const cs of filters.callsigns) {
    chips.push({ key: `cs-${cs}`, label: cs, clear: () => filters.setCallsigns(filters.callsigns.filter((v) => v !== cs)) });
  }
  for (const m of filters.manufacturers) {
    chips.push({ key: `mfr-${m}`, label: `mfr:${m}`, clear: () => filters.setManufacturers(filters.manufacturers.filter((v) => v !== m)) });
  }
  for (const m of filters.models) {
    chips.push({ key: `mdl-${m}`, label: `mdl:${m}`, clear: () => filters.setModels(filters.models.filter((v) => v !== m)) });
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
          <div className="filter-row filter-row--multiselect">
            <MultiSelect
              label="Callsign / Flight"
              options={callsignOptions}
              selected={filters.callsigns}
              onChange={filters.setCallsigns}
              placeholder="Any callsign"
            />
            <MultiSelect
              label="Manufacturer"
              options={manufacturerOptions}
              selected={filters.manufacturers}
              onChange={filters.setManufacturers}
              placeholder="Any manufacturer"
            />
            <MultiSelect
              label="Model"
              options={modelOptions}
              selected={filters.models}
              onChange={filters.setModels}
              placeholder="Any model"
            />
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
                onChange={(e) => {
                  const next = Math.max(0, parseInt(e.target.value) || 0);
                  filters.setAltRange(Math.min(next, filters.altMax), filters.altMax);
                }}
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
                onChange={(e) => {
                  const next = Math.min(60000, parseInt(e.target.value) || 60000);
                  filters.setAltRange(filters.altMin, Math.max(next, filters.altMin));
                }}
              />
            </label>
          </div>

          <div className="filter-phases">
            <span className="filter-phases__label">Phase</span>
            {ALL_PHASES.map((p) => (
              <button
                key={p}
                className={`phase-toggle${filters.phases.includes(p) ? ' phase-toggle--active' : ''}`}
                aria-pressed={filters.phases.includes(p)}
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
