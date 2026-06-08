// src/components/RadarView/AirportPreview.tsx
import type { Airport } from '../../../../shared/types';

interface Props {
  airport: Airport;
  x: number;
  y: number;
}

export function AirportPreview({ airport, x, y }: Props) {
  return (
    <div className="flight-preview" style={{ left: x + 12, top: y - 8 }}>
      <div className="fp-callsign">{airport.iata || airport.icao}</div>
      <div className="fp-type">{airport.name}</div>
    </div>
  );
}
