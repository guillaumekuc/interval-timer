export type TickResult = 'tick' | 'complete';

export class CountdownTimer {
  durationSec = 25 * 60;
  remainingSec = 25 * 60;
  loop = false;
  running = false;
  private anchorRemaining = 25 * 60;
  private anchorTime = 0;

  setDuration(totalSeconds: number): void {
    const v = Math.max(0, Math.floor(totalSeconds));
    this.durationSec = v;
    if (!this.running) {
      this.remainingSec = v;
      this.anchorRemaining = v;
    }
  }

  reset(): void {
    this.running = false;
    this.remainingSec = this.durationSec;
    this.anchorRemaining = this.durationSec;
  }

  toggleLoop(): void {
    this.loop = !this.loop;
  }

  start(now: number): void {
    if (this.durationSec <= 0) return;
    if (this.remainingSec <= 0) this.remainingSec = this.durationSec;
    this.anchorRemaining = this.remainingSec;
    this.anchorTime = now;
    this.running = true;
  }

  pause(now: number): void {
    if (!this.running) return;
    const elapsed = (now - this.anchorTime) / 1000;
    this.remainingSec = Math.max(0, this.anchorRemaining - elapsed);
    this.anchorRemaining = this.remainingSec;
    this.running = false;
  }

  toggleRunning(now: number): void {
    if (this.running) this.pause(now);
    else this.start(now);
  }

  /** Call every frame while running; returns `complete` when crossing to zero (beep). */
  tick(now: number): TickResult {
    if (!this.running) return 'tick';
    const elapsed = (now - this.anchorTime) / 1000;
    const next = Math.max(0, this.anchorRemaining - elapsed);
    const prev = this.remainingSec;
    this.remainingSec = next;
    if (prev > 0 && next <= 0) {
      if (this.loop && this.durationSec > 0) {
        this.anchorRemaining = this.durationSec;
        this.anchorTime = now;
        this.remainingSec = this.durationSec;
      } else {
        this.running = false;
        this.remainingSec = 0;
      }
      return 'complete';
    }
    return 'tick';
  }
}
