// scripts/generate-airports.mjs
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'airports.json');

const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_URL  = 'https://davidmegginson.github.io/ourairports-data/runways.csv';

const KEEP_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport']);

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
  return r.text();
}

function parseLine(line) {
  const fields = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else field += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ',') { fields.push(field); field = ''; }
      else field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function parseCSV(text) {
  const lines = text.split('\n').filter(Boolean);
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]));
  });
}

function num(s) {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

async function main() {
  console.log('Fetching airports.csv...');
  const airportsCsv = await fetchText(AIRPORTS_URL);
  console.log('Fetching runways.csv...');
  const runwaysCsv = await fetchText(RUNWAYS_URL);

  console.log('Parsing...');
  const airportRows = parseCSV(airportsCsv);
  const runwayRows = parseCSV(runwaysCsv);

  // Index runways by airport ident
  const runwaysByIdent = new Map();
  for (const row of runwayRows) {
    if (row.closed === '1') continue;
    const leLat = num(row.le_latitude_deg);
    const leLon = num(row.le_longitude_deg);
    const heLat = num(row.he_latitude_deg);
    const heLon = num(row.he_longitude_deg);
    if (leLat === null || leLon === null || heLat === null || heLon === null) continue;
    const widthFt = num(row.width_ft) ?? 0;
    const lengthFt = num(row.length_ft) ?? 0;
    if (widthFt === 0 || lengthFt === 0) continue;

    const runway = {
      le: { ident: row.le_ident, lat: leLat, lon: leLon },
      he: { ident: row.he_ident, lat: heLat, lon: heLon },
      widthFt,
      lengthFt,
    };

    const ident = row.airport_ident;
    if (!runwaysByIdent.has(ident)) runwaysByIdent.set(ident, []);
    runwaysByIdent.get(ident).push(runway);
  }

  const airports = [];
  for (const row of airportRows) {
    if (!KEEP_TYPES.has(row.type)) continue;
    const lat = num(row.latitude_deg);
    const lon = num(row.longitude_deg);
    if (lat === null || lon === null) continue;

    airports.push({
      icao: row.ident,
      iata: row.iata_code,
      name: row.name,
      lat,
      lon,
      type: row.type,
      runways: runwaysByIdent.get(row.ident) ?? [],
    });
  }

  writeFileSync(OUT, JSON.stringify(airports));
  console.log(`Done. Wrote ${airports.length} airports to public/airports.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
