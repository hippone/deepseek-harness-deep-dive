import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public", "audio");
const sampleRate = 48000;

await mkdir(outputDir, {recursive: true});

const clamp = (value) => Math.max(-1, Math.min(1, value));

// Write 16-bit 2-channel Stereo WAV file
const writeStereoWav = async (filename, durationSeconds, synthStereo) => {
  const sampleCount = Math.ceil(durationSeconds * sampleRate);
  const dataSize = sampleCount * 4; // 2 channels * 2 bytes
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(2, 22);  // NumChannels (2 for Stereo)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28); // ByteRate
  buffer.writeUInt16LE(4, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Simple stereo delay/reverb buffer
  const delaySamplesL = Math.floor(sampleRate * 0.045);
  const delaySamplesR = Math.floor(sampleRate * 0.065);
  const delayBufL = new Float32Array(delaySamplesL);
  const delayBufR = new Float32Array(delaySamplesR);
  let dIdxL = 0;
  let dIdxR = 0;

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const [rawL, rawR] = synthStereo(t, durationSeconds, i);

    // Add stereo spatial reverberation
    const revL = delayBufL[dIdxL] * 0.35;
    const revR = delayBufR[dIdxR] * 0.35;

    const outL = rawL + revL;
    const outR = rawR + revR;

    delayBufL[dIdxL] = rawL + revL * 0.25;
    delayBufR[dIdxR] = rawR + revR * 0.25;

    dIdxL = (dIdxL + 1) % delaySamplesL;
    dIdxR = (dIdxR + 1) % delaySamplesR;

    buffer.writeInt16LE(Math.round(clamp(outL) * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(clamp(outR) * 32767), 44 + i * 4 + 2);
  }

  await writeFile(path.join(outputDir, filename), buffer);
  console.log(`Generated high-fidelity stereo audio: ${filename}`);
};

// =========================================================================
// 1. IMPACT.WAV (Cinema Cyber Sub-Impact with Stereo Air Burst)
// =========================================================================
await writeStereoWav("impact.wav", 1.8, (t) => {
  const envPunch = Math.exp(-4.5 * t);
  const envSub = Math.exp(-2.2 * t);
  
  // 808 Sub Pitch Drop (130Hz -> 36Hz)
  const freq = 36 + 94 * Math.exp(-14 * t);
  const phase = 2 * Math.PI * freq * t;
  const sub = Math.sin(phase) + 0.3 * Math.sin(phase * 2) * Math.exp(-8 * t);

  // Transient Click (metallic high snap)
  const snap = (Math.sin(2 * Math.PI * 1400 * t) + Math.sin(2 * Math.PI * 2800 * t) * 0.5) * Math.exp(-55 * t);

  // Wide Stereo Noise Burst
  const noiseL = (Math.random() * 2 - 1) * Math.exp(-12 * t);
  const noiseR = (Math.random() * 2 - 1) * Math.exp(-12 * t);

  const left = (sub * 0.8 + snap * 0.25 + noiseL * 0.12) * envPunch;
  const right = (sub * 0.8 + snap * 0.25 + noiseR * 0.12) * envPunch;

  return [left, right];
});

// =========================================================================
// 2. WHOOSH.WAV (Ultra-soft velvet air swish - NO tonal whine)
// =========================================================================
await writeStereoWav("whoosh.wav", 0.6, (t, duration) => {
  const p = t / duration;
  // Smooth Bell envelope
  const env = Math.sin(Math.PI * p) ** 3.0;

  // Generate smooth filtered air (Pink noise approximation)
  let b0 = 0, b1 = 0, b2 = 0;
  const white = Math.random() * 2 - 1;
  b0 = 0.99886 * b0 + white * 0.0555179;
  b1 = 0.99332 * b1 + white * 0.0750759;
  b2 = 0.96900 * b2 + white * 0.1538520;
  const pink = b0 + b1 + b2 + white * 0.5362;

  // Gentle high-cut and pan
  const panL = 0.5 + 0.3 * Math.cos(p * Math.PI);
  const panR = 0.5 - 0.3 * Math.cos(p * Math.PI);

  const softAir = pink * env * 0.28;

  return [softAir * panL, softAir * panR];
});

// =========================================================================
// 3. TICK.WAV (Crisp, High-Precision Apple/Linear UI Tap)
// =========================================================================
await writeStereoWav("tick.wav", 0.12, (t) => {
  const env = Math.exp(-75 * t);
  const f = 2400;
  // Glassy click with soft harmonics
  const click = Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * (f * 1.5) * t) * 0.25;
  const thud = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-45 * t) * 0.4;
  const out = (click + thud) * env * 0.5;
  return [out * 0.9, out * 1.1]; // Subtle stereo spread
});

// =========================================================================
// 4. BGM.WAV (46-second Calm Ambient Tech / Deep Cinematic Soundscape)
// =========================================================================
await writeStereoWav("bgm.wav", 46.0, (t) => {
  const bpm = 90; // Relaxed, breathing tempo
  const beatTime = 60 / bpm;
  const beat = t / beatTime;
  const bar = Math.floor(beat / 4);

  // Overall smooth master volume envelope
  const fadeIn = Math.min(1, t / 3.0);
  const fadeOut = Math.min(1, (46.0 - t) / 3.5);
  const masterVol = fadeIn * fadeOut * 0.35;

  // 1. Soft, deep ambient pulse (every 2 beats, extremely gentle)
  let subPulse = 0;
  if (t > 3.0 && t < 43.0) {
    const pulseFract = (beat % 2);
    const pulseEnv = Math.exp(-4.5 * pulseFract * beatTime);
    subPulse = Math.sin(2 * Math.PI * 46 * (pulseFract * beatTime)) * pulseEnv * 0.45;
  }

  // 2. Warm Cinematic Analog Pad (Slow evolving chords)
  // Chord progression: Dm9 -> Bbmaj7 -> Fmaj7 -> C9
  const chords = [
    [146.83, 174.61, 220.00, 261.63], // Dm9
    [116.54, 146.83, 174.61, 220.00], // Bbmaj7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [130.81, 164.81, 196.00, 246.94], // C
  ];
  const currentChord = chords[bar % chords.length] || chords[0];

  let pad = 0;
  for (let j = 0; j < currentChord.length; j++) {
    const freq = currentChord[j];
    // Gentle chorus detune
    pad += Math.sin(2 * Math.PI * freq * t + j) * 0.1;
    pad += Math.sin(2 * Math.PI * (freq * 1.003) * t + j * 0.5) * 0.08;
  }

  // 3. Gentle Sparkling Starlight Tones (Slow 8th note twinkling)
  let sparkle = 0;
  if (t > 4.0 && t < 42.0) {
    const spScale = [587.33, 659.25, 783.99, 880.00, 1046.50];
    const spIdx = Math.floor(beat * 2) % spScale.length;
    const spFreq = spScale[spIdx];
    const spFract = (beat * 2) % 1;
    const spEnv = Math.exp(-7.5 * spFract * (beatTime / 2));
    sparkle = Math.sin(2 * Math.PI * spFreq * t) * spEnv * 0.12;
  }

  // Stereo slow drift
  const driftL = 0.5 + 0.3 * Math.sin(t * 0.3);
  const driftR = 0.5 - 0.3 * Math.sin(t * 0.3);

  const mixL = (subPulse * 0.6 + pad * 0.7 + sparkle * driftL) * masterVol;
  const mixR = (subPulse * 0.6 + pad * 0.7 + sparkle * driftR) * masterVol;

  return [mixL, mixR];
});

console.log("All relaxed cinematic audio tracks generated successfully!");
