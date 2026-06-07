import { describe, it, expect } from 'vitest';
import { inferFlightPhase } from './AircraftProcessor';

describe('inferFlightPhase', () => {
  it('TXI: slow, low', () => expect(inferFlightPhase(200, 25, 0)).toBe('TXI'));
  it('GND: stationary on ground', () => expect(inferFlightPhase(0, 0, 0)).toBe('GND'));
  it('T/O: climbing hard from low alt', () => expect(inferFlightPhase(1000, 160, 1500)).toBe('T/O'));
  it('APP: descending at low alt', () => expect(inferFlightPhase(3000, 140, -500)).toBe('APP'));
  it('CLB: positive rate at altitude', () => expect(inferFlightPhase(15000, 400, 500)).toBe('CLB'));
  it('DSC: negative rate at altitude', () => expect(inferFlightPhase(15000, 400, -500)).toBe('DSC'));
  it('CRZ: level at cruise', () => expect(inferFlightPhase(35000, 450, 0)).toBe('CRZ'));
});
