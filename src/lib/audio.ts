export function playEmergencyAlert(): void {
  const ctx = new AudioContext();

  function playTone(freq: number, startTime: number, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  playTone(880, ctx.currentTime, 0.2);
  playTone(1100, ctx.currentTime + 0.2, 0.2);
}
