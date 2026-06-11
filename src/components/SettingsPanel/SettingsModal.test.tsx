import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { useCompassStore } from '../../hooks/useCompass';
import { useSettingsStore } from '../../hooks/useSettings';
import { DEFAULT_SETTINGS } from '../../types/aircraft';

beforeEach(() => {
  useCompassStore.setState({ isActive: false, error: null });
  useSettingsStore.setState(DEFAULT_SETTINGS);
  // Make DeviceOrientationEvent available so unsupported path is not taken
  (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {};
});

describe('SettingsModal compass UI', () => {
  it('renders "Use compass" button when compass is inactive and supported', () => {
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /use compass/i })).toBeInTheDocument();
  });

  it('shows the heading input when compass is inactive', () => {
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByLabelText(/radar heading/i)).toBeInTheDocument();
  });

  it('hides the heading input when compass is active', () => {
    act(() => { useCompassStore.setState({ isActive: true, error: null }); });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.queryByLabelText(/radar heading/i)).not.toBeInTheDocument();
  });

  it('shows compass active status with current heading when compass is active', () => {
    act(() => {
      useCompassStore.setState({ isActive: true, error: null });
      useSettingsStore.setState({ ...DEFAULT_SETTINGS, headingDeg: 90 });
    });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByText(/Compass active · 90°/)).toBeInTheDocument();
  });

  it('shows "Stop" button when compass is active', () => {
    act(() => { useCompassStore.setState({ isActive: true, error: null }); });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('shows denied message when error is denied', () => {
    act(() => { useCompassStore.setState({ isActive: false, error: 'denied' }); });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByText(/compass permission denied/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use compass/i })).not.toBeInTheDocument();
  });

  it('does not show compass button when DeviceOrientationEvent is unsupported', () => {
    act(() => { useCompassStore.setState({ isActive: false, error: 'unsupported' }); });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /use compass/i })).not.toBeInTheDocument();
    // Manual input still visible
    expect(screen.getByLabelText(/radar heading/i)).toBeInTheDocument();
  });
});
