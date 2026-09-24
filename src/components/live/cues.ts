/**
 * Step-transition cues (§72): a short tone and a vibration, each switchable in
 * settings. The visual change and the spoken (aria-live) announcement always
 * happen, so nothing depends on sound alone.
 */
let context: AudioContext | null = null;

export function playTone() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
  } catch {
    /* Audio is optional. */
  }
}

export function vibrate() {
  try {
    navigator.vibrate?.([180, 80, 180]);
  } catch {
    /* Vibration is optional. */
  }
}

/** Browsers only allow audio after a user gesture; call from the Start tap. */
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    void context.resume();
  } catch {
    /* ignore */
  }
}
