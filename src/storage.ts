import type { CountdownTimer } from './timer-engine';

const KEY = 'interval-timer-state-v1';

export interface PersistedState {
  durationSec: number;
  loop: boolean;
}

export function load(): PersistedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.durationSec !== 'number' || typeof data.loop !== 'boolean')
      return null;
    return {
      durationSec: Math.max(0, Math.floor(data.durationSec)),
      loop: data.loop,
    };
  } catch {
    return null;
  }
}

export function save(timer: CountdownTimer): void {
  const payload: PersistedState = {
    durationSec: timer.durationSec,
    loop: timer.loop,
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}
