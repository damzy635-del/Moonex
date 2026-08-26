// Audio utilities for Gemini TTS and Web Speech APIs with Speed Modulation

let currentAudioContext: AudioContext | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;

// Plays 24kHz 16-bit PCM little-endian audio returned by Gemini TTS with adjustable playback rate
export async function playPcmAudio(
  base64Data: string,
  sampleRate = 24000,
  playbackRate = 1.0
): Promise<void> {
  try {
    stopAllSpeech();

    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate,
    });
    currentAudioContext = audioContext;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const audioBuffer = audioContext.createBuffer(1, int16Array.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < int16Array.length; i++) {
      channelData[i] = int16Array[i] / 32768.0;
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = playbackRate;
    source.connect(audioContext.destination);
    currentSourceNode = source;
    source.start();

    return new Promise((resolve) => {
      source.onended = () => {
        if (currentAudioContext === audioContext) {
          currentAudioContext = null;
          currentSourceNode = null;
        }
        audioContext.close();
        resolve();
      };
    });
  } catch (error) {
    console.error('Failed to play PCM audio:', error);
    throw error;
  }
}

// Fallback Browser Native Speech Synthesis with adjustable playback rate
export function speakTextNative(
  text: string,
  onEnd?: () => void,
  playbackRate: number = 1.0
): () => void {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    if (onEnd) onEnd();
    return () => {};
  }

  window.speechSynthesis.cancel(); // Stop any previous speech

  const cleanText = text
    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*#_~\[\]()]/g, '')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = playbackRate;
  utterance.pitch = 1.0;

  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}

// Stop any currently playing audio (both Web Audio API & SpeechSynthesis)
export function stopAllSpeech(): void {
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
    } catch {}
    currentSourceNode = null;
  }
  if (currentAudioContext) {
    try {
      currentAudioContext.close();
    } catch {}
    currentAudioContext = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
