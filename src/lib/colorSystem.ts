const MANUFACTURER_PREFIXES: [string, string][] = [
  ['B74', 'Boeing'],
  ['B75', 'Boeing'],
  ['B76', 'Boeing'],
  ['B77', 'Boeing'],
  ['B78', 'Boeing'],
  ['B7', 'Boeing'],
  ['A3', 'Airbus'],
  ['A2', 'Airbus'],
  ['CRJ', 'Bombardier'],
  ['BD7', 'Bombardier'],
  ['E17', 'Embraer'],
  ['E19', 'Embraer'],
  ['E29', 'Embraer'],
  ['ERJ', 'Embraer'],
  ['E1', 'Embraer'],
  ['DH', 'De Havilland'],
  ['AT4', 'ATR'],
  ['AT7', 'ATR'],
  ['GLF', 'Gulfstream'],
  ['GL5', 'Gulfstream'],
  ['GL6', 'Gulfstream'],
  ['GL7', 'Gulfstream'],
  ['C25', 'Cessna'],
  ['C5', 'Cessna'],
  ['C68', 'Cessna'],
  ['LJ', 'Learjet'],
  ['F9', 'Dassault'],
  ['F2T', 'Dassault'],
  ['MD', 'McDonnell Douglas'],
  ['DC', 'McDonnell Douglas'],
];

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getManufacturer(typeCode: string): string {
  const t = typeCode.toUpperCase();
  for (const [prefix, name] of MANUFACTURER_PREFIXES) {
    if (t.startsWith(prefix)) return name;
  }
  return t.slice(0, 3);
}

export function aircraftColor(typeCode: string): string {
  const manufacturer = getManufacturer(typeCode);
  const hue = djb2(manufacturer) % 360;
  const lightness = 55 + (djb2(typeCode + 'L') % 25);
  const saturation = 90 + (djb2(typeCode + 'S') % 10);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function lightenHsl(hslStr: string, amount: number): string {
  const m = hslStr.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
  if (!m) return hslStr;
  const [, h, s, l] = m.map(Number);
  const newL = Math.min(100, l + Math.round(amount * 100));
  return `hsl(${h}, ${s}%, ${newL}%)`;
}
