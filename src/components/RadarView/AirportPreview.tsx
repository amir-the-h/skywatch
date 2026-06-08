// src/components/RadarView/AirportPreview.tsx
import type { Airport, MetarData } from '../../../../shared/types';

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function toCardinal(deg: number): string {
  return CARDINALS[Math.round(deg / 45) % 8];
}

interface Props {
  airport: Airport;
  x: number;
  y: number;
  metar?: MetarData;
}

export function AirportPreview({ airport, x, y, metar }: Props) {
  return (
    <div className="flight-preview" style={{ left: x + 12, top: y - 8 }}>
      <div className="fp-callsign">{airport.iata || airport.icao}</div>
      <div className="fp-type">{airport.name}</div>
      {metar && (
        <>
          <div className="fp-row">
            {metar.windDir === null
              ? 'VRB'
              : `${metar.windDir}° ${toCardinal(metar.windDir)}`}{' '}
            {metar.windSpeed}kt{metar.windGust ? ` G${metar.windGust}kt` : ''}
          </div>
          <div className="fp-raw">{metar.raw}</div>
        </>
      )}
    </div>
  );
}
