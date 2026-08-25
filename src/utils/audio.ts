// Audio utilities for Gemini TTS and Web Speech APIs

// Plays 24kHz 16-bit PCM little-endian audio returned by Gemini TTS
export async function playPcmAudio(base64Data: string, sampleRate = 24000): Promise<void> {
  try {
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
    source.connect(audioContext.destination);
    source.start();

    return new Promise((resolve) => {
      source.onended = () => {
        audioContext.close();
        resolve();
      };
    });
  } catch (error) {
    console.error('Failed to play PCM audio:', error);
    throw error;
  }
}

// Fallback Browser Native Speech Synthesis
export function speakTextNative(text: string, onEnd?: () => void): () => void {
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
  utterance.rate = 1.0;
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

// Stop any currently playing audio
export function stopAllSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
