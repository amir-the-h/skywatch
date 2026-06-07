import type { Aircraft } from '../../types/aircraft';

interface Props {
  aircraft: Aircraft;
  x: number;
  y: number;
  scale?: number;
}

export function FlightPreview({ aircraft, x, y, scale = 1 }: Props) {
  return (
    <div
      className="flight-preview"
      style={{
        left: x + 12,
        top: y - 8,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <div className="fp-callsign">{aircraft.flight || aircraft.hex}</div>
      <div className="fp-type">{aircraft.desc ?? aircraft.t}</div>
      <div className="fp-data">
        {aircraft.alt_baro.toLocaleString()} ft · {Math.round(aircraft.gs)} kts
      </div>
    </div>
  );
}
