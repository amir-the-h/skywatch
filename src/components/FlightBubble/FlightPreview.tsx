// src/components/FlightBubble/FlightPreview.tsx
import type { Aircraft } from '../../types/aircraft';

interface Props {
  aircraft: Aircraft;
  x: number;
  y: number;
}

export function FlightPreview({ aircraft, x, y }: Props) {
  return (
    <div
      className="flight-preview"
      style={{ left: x + 12, top: y - 8 }}
    >
      <div className="fp-callsign">{aircraft.flight || aircraft.hex}</div>
      <div className="fp-type">{aircraft.t}</div>
      <div className="fp-data">
        {aircraft.alt_baro.toLocaleString()} ft · {Math.round(aircraft.gs)} kts
      </div>
    </div>
  );
}
