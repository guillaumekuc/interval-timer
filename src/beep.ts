let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Short beep when interval completes — strong level (browser/system volume still apply). */
export function playBeep(): void {
  const c = getCtx();
  if (c.state === 'suspended') void c.resume();

  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const comp = c.createDynamicsCompressor();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

  comp.threshold.setValueAtTime(-22, t);
  comp.knee.setValueAtTime(18, t);
  comp.ratio.setValueAtTime(4, t);
  comp.attack.setValueAtTime(0.001, t);
  comp.release.setValueAtTime(0.08, t);

  osc.connect(gain);
  gain.connect(comp);
  comp.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.4);
}
