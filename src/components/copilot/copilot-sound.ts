"use client";

const SOUND_KEY = "aa:copilot:sound";

let ctx: AudioContext | null = null;

export function copilotSoundEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setCopilotSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/** Browsers only allow audio after a user gesture — call this from the send click / Enter. */
export function unlockCopilotSound() {
  const ac = audio();
  if (ac?.state === "suspended") void ac.resume().catch(() => undefined);
}

/** Soft two-note bell (synthesised, no audio file to download). */
export function playCopilotChime() {
  if (!copilotSoundEnabled()) return;
  const ac = audio();
  if (!ac || ac.state !== "running") return;
  const now = ac.currentTime;
  [
    { freq: 880, at: 0 },
    { freq: 1318.5, at: 0.11 },
  ].forEach(({ freq, at }) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(0.12, now + at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.45);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.5);
  });
}
