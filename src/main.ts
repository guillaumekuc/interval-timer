import '@fortawesome/fontawesome-free/css/all.min.css';
import './style.css';
import { CountdownTimer } from './timer-engine';
import { load, save } from './storage';
import { playBeep } from './beep';

const timer = new CountdownTimer();

type Segment = 'h' | 'm' | 's';

function pad2(n: number): string {
  return String(Math.min(99, Math.max(0, n))).padStart(2, '0');
}

/** Whole seconds only — internal `remainingSec` is fractional between ticks. */
function formatHMS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function segments(totalSeconds: number): { h: number; m: number; s: number } {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s };
}

function fromSegments(h: number, m: number, s: number): number {
  return h * 3600 + m * 60 + s;
}

function clampSeg(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.floor(value)));
}

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
<div class="screen">
  <div class="timer-card" id="card">
    <button type="button" class="timer-card__pip" id="pipBtn" title="Picture-in-picture" aria-label="Open picture in picture">
      <i class="fa-solid fa-clone" aria-hidden="true"></i>
    </button>
    <div class="timer-card__time" id="timeDisplay" title="Double-click to edit"></div>
    <div class="timer-card__controls">
      <button type="button" class="ctrl-round ctrl-round--primary" id="playPause" aria-label="Play">
        <i class="fa-solid fa-play" id="playPauseIcon" aria-hidden="true"></i>
      </button>
      <button type="button" class="ctrl-round ctrl-round--ghost" id="resetBtn" aria-label="Reset timer">
        <i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i>
      </button>
      <button type="button" class="ctrl-round ctrl-round--ghost ctrl-round--loop" id="loopBtn" aria-label="Toggle loop" title="Loop when timer completes">
        <i class="fa-solid fa-repeat" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</div>

<div class="overlay" id="editOverlay" aria-hidden="true">
  <div class="edit-panel" role="dialog" aria-modal="true" aria-labelledby="editTitle">
    <div class="edit-panel__head">
      <h2 class="edit-panel__title" id="editTitle">Edit timer</h2>
    </div>
    <div class="time-rail">
      <div class="time-rail__row">
        <div class="time-seg" data-seg="h">
          <button type="button" class="time-seg__chev" data-step="up" aria-label="Increase hours">
            <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
          </button>
          <div class="time-seg__box" data-box="h"><input class="time-seg__input" id="inH" inputmode="numeric" maxlength="2" aria-label="Hours" /></div>
          <button type="button" class="time-seg__chev" data-step="down" aria-label="Decrease hours">
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
        </div>
        <span class="sep">:</span>
        <div class="time-seg" data-seg="m">
          <button type="button" class="time-seg__chev" data-step="up" aria-label="Increase minutes">
            <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
          </button>
          <div class="time-seg__box" data-box="m"><input class="time-seg__input" id="inM" inputmode="numeric" maxlength="2" aria-label="Minutes" /></div>
          <button type="button" class="time-seg__chev" data-step="down" aria-label="Decrease minutes">
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
        </div>
        <span class="sep">:</span>
        <div class="time-seg" data-seg="s">
          <button type="button" class="time-seg__chev" data-step="up" aria-label="Increase seconds">
            <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
          </button>
          <div class="time-seg__box" data-box="s"><input class="time-seg__input" id="inS" inputmode="numeric" maxlength="2" aria-label="Seconds" /></div>
          <button type="button" class="time-seg__chev" data-step="down" aria-label="Decrease seconds">
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
    <div class="edit-actions">
      <button type="button" class="edit-actions__btn edit-actions__btn--validate" id="validateEdit" aria-label="Validate and apply time">
        <i class="fa-solid fa-check" aria-hidden="true"></i>
        Validate
      </button>
    </div>
  </div>
</div>
`;

const el = {
  timeDisplay: app.querySelector<HTMLDivElement>('#timeDisplay')!,
  playPause: app.querySelector<HTMLButtonElement>('#playPause')!,
  playPauseIcon: app.querySelector<HTMLElement>('#playPauseIcon')!,
  resetBtn: app.querySelector<HTMLButtonElement>('#resetBtn')!,
  loopBtn: app.querySelector<HTMLButtonElement>('#loopBtn')!,
  pipBtn: app.querySelector<HTMLButtonElement>('#pipBtn')!,
  editOverlay: app.querySelector<HTMLDivElement>('#editOverlay')!,
  inH: app.querySelector<HTMLInputElement>('#inH')!,
  inM: app.querySelector<HTMLInputElement>('#inM')!,
  inS: app.querySelector<HTMLInputElement>('#inS')!,
};

let activeSeg: Segment = 'h';
let draftTotal = timer.durationSec;
let pipWindow: Window | null = null;

function refreshPlayPauseUi(): void {
  const on = timer.running;
  el.playPauseIcon.className = on ? 'fa-solid fa-pause' : 'fa-solid fa-play';
  el.playPause.setAttribute('aria-label', on ? 'Pause' : 'Play');
}

function refreshLoopUi(): void {
  el.loopBtn.classList.toggle('is-on', timer.loop);
}

function uiFromTimer(): void {
  el.timeDisplay.textContent = formatHMS(timer.remainingSec);
  refreshPlayPauseUi();
  refreshLoopUi();
  syncPipDisplay();
}

function persist(): void {
  save(timer);
}

const restored = load();
if (restored) {
  timer.setDuration(restored.durationSec);
  timer.reset();
  timer.loop = restored.loop;
}

function openEdit(): void {
  timer.pause(performance.now());
  draftTotal = timer.durationSec;
  const { h, m, s } = segments(draftTotal);
  el.inH.value = pad2(h);
  el.inM.value = pad2(m);
  el.inS.value = pad2(s);
  setActiveSeg('h');
  el.editOverlay.classList.add('is-open');
  el.editOverlay.setAttribute('aria-hidden', 'false');
  el.inH.focus();
  el.inH.select();
  refreshPlayPauseUi();
  uiFromTimer();
}

function closeEdit(): void {
  el.editOverlay.classList.remove('is-open');
  el.editOverlay.setAttribute('aria-hidden', 'true');
}

function validateAndClose(): void {
  draftTotal = draftFromInputs();
  timer.pause(performance.now());
  timer.setDuration(draftTotal);
  timer.reset();
  persist();
  closeEdit();
  uiFromTimer();
}

function draftFromInputs(): number {
  const h = clampSeg(Number.parseInt(el.inH.value, 10) || 0, 99);
  const mRaw = Number.parseInt(el.inM.value, 10) || 0;
  const sRaw = Number.parseInt(el.inS.value, 10) || 0;
  const m = clampSeg(mRaw, 59);
  const s = clampSeg(sRaw, 59);
  el.inH.value = pad2(Math.min(h, 99));
  el.inM.value = pad2(m);
  el.inS.value = pad2(s);
  return fromSegments(Math.min(h, 99), m, s);
}

function setActiveSeg(seg: Segment): void {
  activeSeg = seg;
  app.querySelectorAll<HTMLDivElement>('[data-box]').forEach((box) => {
    box.classList.toggle('is-active', box.dataset.box === seg);
  });
}

function bumpSegment(dir: 1 | -1): void {
  let { h, m, s } = segments(draftFromInputs());
  const capH = 99;
  if (activeSeg === 'h') h = clampSeg(h + dir, capH);
  if (activeSeg === 'm') m = (m + dir + 60) % 60;
  if (activeSeg === 's') s = (s + dir + 60) % 60;
  draftTotal = fromSegments(h, m, s);
  el.inH.value = pad2(h);
  el.inM.value = pad2(m);
  el.inS.value = pad2(s);
}

el.timeDisplay.addEventListener('dblclick', (e) => {
  e.preventDefault();
  openEdit();
});

el.playPause.addEventListener('click', () => {
  timer.toggleRunning(performance.now());
  persist();
  refreshPlayPauseUi();
  uiFromTimer();
});

el.resetBtn.addEventListener('click', () => {
  timer.pause(performance.now());
  timer.reset();
  persist();
  refreshPlayPauseUi();
  uiFromTimer();
});

el.loopBtn.addEventListener('click', () => {
  timer.toggleLoop();
  persist();
  refreshLoopUi();
});

app.querySelector('#validateEdit')!.addEventListener('click', () => {
  validateAndClose();
});

for (const seg of ['h', 'm', 's'] as const) {
  const wrap = app.querySelector(`[data-seg="${seg}"]`);
  wrap?.querySelectorAll<HTMLButtonElement>('.time-seg__chev').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveSeg(seg);
      bumpSegment(btn.dataset.step === 'up' ? 1 : -1);
    });
  });
  wrap?.querySelector<HTMLInputElement>('.time-seg__input')?.addEventListener('focus', () => setActiveSeg(seg));
}

for (const input of [el.inH, el.inM, el.inS]) {
  input.addEventListener('change', () => {
    draftTotal = draftFromInputs();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      validateAndClose();
    }
  });
}

el.editOverlay.addEventListener('click', (e) => {
  if (e.target === el.editOverlay) closeEdit();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && el.editOverlay.classList.contains('is-open')) {
    e.preventDefault();
    closeEdit();
    uiFromTimer();
  }
});

function syncPipDisplay(): void {
  if (!pipWindow || pipWindow.closed) return;
  const root = pipWindow.document.getElementById('pipTime');
  if (root) root.textContent = formatHMS(timer.remainingSec);
}

async function openPip(): Promise<void> {
  const api = window.documentPictureInPicture;
  if (!api) return;
  if (pipWindow && !pipWindow.closed) {
    pipWindow.focus();
    return;
  }
  const pip = await api.requestWindow({ width: 300, height: 140 });
  pipWindow = pip;
  pip.document.title = 'Interval Timer';
  pip.document.body.style.margin = '0';
  pip.document.body.style.background = '#222';
  pip.document.body.style.color = '#f4f4f4';
  pip.document.body.style.fontFamily = `'Inter', system-ui, sans-serif`;
  pip.document.body.style.display = 'flex';
  pip.document.body.style.alignItems = 'center';
  pip.document.body.style.justifyContent = 'center';
  pip.document.body.style.minHeight = '100vh';
  pip.document.body.innerHTML = `
    <div id="pipTime" style="font-size:2rem;font-weight:700;letter-spacing:.06em;font-variant-numeric:tabular-nums;"></div>
  `;
  syncPipDisplay();
  pip.addEventListener('pagehide', () => {
    pipWindow = null;
  });
}

if (window.documentPictureInPicture) {
  el.pipBtn.addEventListener('click', () => void openPip());
} else {
  el.pipBtn.hidden = true;
}

function tick(now: number): void {
  const r = timer.tick(now);
  if (r === 'complete') playBeep();
  uiFromTimer();
}

function rafLoop(now: number): void {
  tick(now);
  requestAnimationFrame(rafLoop);
}

uiFromTimer();
requestAnimationFrame(rafLoop);
