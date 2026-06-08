import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type { Airport } from '../../shared/types';

vi.mock('fs/promises');

const makeAirport = (icao: string): Airport => ({
  icao, iata: icao.slice(1), name: `${icao} Airport`,
  lat: 34, lon: -118, type: 'large_airport', runways: [],
});

const mockStore = {
  getAirportsHash: vi.fn(),
  saveAllAirports: vi.fn(),
  saveAirportIcaos: vi.fn(),
  setAirportsHash: vi.fn(),
};

describe('AirportLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStore.saveAllAirports.mockResolvedValue(undefined);
    mockStore.saveAirportIcaos.mockResolvedValue(undefined);
    mockStore.setAirportsHash.mockResolvedValue(undefined);
  });

  it('skips load when stored hash matches file hash', async () => {
    const airports = [makeAirport('KLAX')];
    const raw = JSON.stringify(airports);
    const hash = crypto.createHash('sha256').update(raw).digest('hex');

    vi.mocked(fs.readFile).mockResolvedValue(raw as never);
    mockStore.getAirportsHash.mockResolvedValue(hash);

    const { loadAirports } = await import('./AirportLoader');
    await loadAirports(mockStore as never);

    expect(mockStore.saveAllAirports).not.toHaveBeenCalled();
    expect(mockStore.setAirportsHash).not.toHaveBeenCalled();
  });

  it('loads airports and sets hash when stored hash is missing', async () => {
    const airports = [makeAirport('KLAX'), makeAirport('KORD')];
    const raw = JSON.stringify(airports);

    vi.mocked(fs.readFile).mockResolvedValue(raw as never);
    mockStore.getAirportsHash.mockResolvedValue(null);

    const { loadAirports } = await import('./AirportLoader');
    await loadAirports(mockStore as never);

    expect(mockStore.saveAllAirports).toHaveBeenCalledWith(airports);
    expect(mockStore.saveAirportIcaos).toHaveBeenCalledWith(['KLAX', 'KORD']);
    expect(mockStore.setAirportsHash).toHaveBeenCalled();
  });

  it('loads airports when hash is stale', async () => {
    const airports = [makeAirport('KLAX')];
    const raw = JSON.stringify(airports);

    vi.mocked(fs.readFile).mockResolvedValue(raw as never);
    mockStore.getAirportsHash.mockResolvedValue('old-hash-that-does-not-match');

    const { loadAirports } = await import('./AirportLoader');
    await loadAirports(mockStore as never);

    expect(mockStore.saveAllAirports).toHaveBeenCalledWith(airports);
  });

  it('sets hash AFTER airports are stored', async () => {
    const airports = [makeAirport('KLAX')];
    const raw = JSON.stringify(airports);
    const callOrder: string[] = [];

    vi.mocked(fs.readFile).mockResolvedValue(raw as never);
    mockStore.getAirportsHash.mockResolvedValue(null);
    mockStore.saveAllAirports.mockImplementation(async () => { callOrder.push('saveAllAirports'); });
    mockStore.saveAirportIcaos.mockImplementation(async () => { callOrder.push('saveAirportIcaos'); });
    mockStore.setAirportsHash.mockImplementation(async () => { callOrder.push('setAirportsHash'); });

    const { loadAirports } = await import('./AirportLoader');
    await loadAirports(mockStore as never);

    expect(callOrder).toEqual(['saveAllAirports', 'saveAirportIcaos', 'setAirportsHash']);
  });
});
