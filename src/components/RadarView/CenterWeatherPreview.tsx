import type { PointWeather } from '../../../../shared/types';

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function toCardinal(deg: number): string {
  return CARDINALS[Math.round(deg / 45) % 8];
}

interface Props {
  weather: PointWeather;
  x: number;
  y: number;
}

export function CenterWeatherPreview({ weather, x, y }: Props) {
  const { windDir, windSpeed, windGust, observedAt } = weather;
  const dirStr = windDir === null ? 'VRB' : `${windDir}° ${toCardinal(windDir)}`;
  const speedStr = `${windSpeed}kt${windGust ? ` G${windGust}kt` : ''}`;
  const time = new Date(observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flight-preview" style={{ left: x + 12, top: y - 8 }}>
      <div className="fp-callsign">Surface winds</div>
      <div className="fp-row">{dirStr} &nbsp; {speedStr}</div>
      <div className="fp-type">Open-Meteo · {time}</div>
    </div>
  );
}
