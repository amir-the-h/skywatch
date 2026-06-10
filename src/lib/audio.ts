let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number) {
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

export function playEmergencyAlert(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    playTone(ctx, 880, ctx.currentTime, 0.2);
    playTone(ctx, 1100, ctx.currentTime + 0.2, 0.2);
  } catch {
    // Web Audio API unavailable or restricted — fail silently
  }
}
