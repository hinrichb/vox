"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { copyToClipboard, transcribeAudio } from "@/lib/tauri";
import { getSettings, getSelectedMode, getMatchingTriggerWords, updateStats } from "@/lib/storage";
import { processWithAI } from "@/lib/openrouter";

type RecordingState = "idle" | "recording" | "transcribing" | "processing" | "error";

export default function Overlay() {
  const [state, setState] = useState<RecordingState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [barHeights, setBarHeights] = useState<number[]>(Array(20).fill(8));
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const prevHeightsRef = useRef<number[]>(Array(20).fill(8));

  const closeOverlay = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("close_overlay");
    } catch (e) {
      // Ignore
    }
  }, []);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const updateWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = 20;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      analyser.getByteFrequencyData(dataArray);

      const newHeights: number[] = [];
      const prevHeights = prevHeightsRef.current;

      // Use only the lower half of frequencies (voice range)
      const usableLength = Math.floor(bufferLength / 2);
      const step = Math.floor(usableLength / barCount);

      for (let i = 0; i < barCount; i++) {
        // Average a few bins for smoother result
        let sum = 0;
        const startIdx = i * step;
        for (let j = 0; j < step; j++) {
          sum += dataArray[startIdx + j] || 0;
        }
        const avgValue = sum / step;

        // Sensitivity
        const amplitude = Math.min(1, (avgValue / 255) * 1.6);

        const minHeight = 8;
        const maxHeight = 46;
        const targetHeight = minHeight + amplitude * (maxHeight - minHeight);

        // Smooth animation - ease toward target
        const smoothing = 0.25;
        const height = prevHeights[i] + (targetHeight - prevHeights[i]) * smoothing;
        newHeights.push(height);
      }

      prevHeightsRef.current = newHeights;
      setBarHeights(newHeights);
    };

    animate();
  }, []);

  const floatTo16BitPCM = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  };

  const createWavBlob = (audioData: Float32Array, sampleRate: number): Blob => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const pcmData = floatTo16BitPCM(audioData);
    const dataOffset = 44;
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(dataOffset + i * 2, pcmData[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const stopRecording = useCallback(async () => {
    if (state !== "recording") return;

    setState("transcribing");

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
    }

    const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);

    if (totalLength === 0) {
      setErrorMsg("No audio recorded");
      setState("error");
      return;
    }

    const combinedAudio = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const wavBlob = createWavBlob(combinedAudio, sampleRate);

    cleanup();

    try {
      // Step 1: Transcribe
      const transcript = await transcribeAudio(wavBlob);

      if (!transcript.trim()) {
        closeOverlay();
        return;
      }

      // Step 2: Check if we need AI processing
      const settings = getSettings();
      const selectedMode = getSelectedMode(settings);
      const matchingTriggers = getMatchingTriggerWords(transcript, settings.triggerWords || []);

      // If normal mode and no trigger words, just copy transcript
      if ((selectedMode.id === "normal" || !selectedMode.prompt) && matchingTriggers.length === 0) {
        await copyToClipboard(transcript.trim());
        updateStats(transcript.trim());
        closeOverlay();
        return;
      }

      // Step 3: Process with AI
      if (!settings.openRouterApiKey) {
        // No API key, just copy transcript
        await copyToClipboard(transcript.trim());
        updateStats(transcript.trim());
        closeOverlay();
        return;
      }

      setState("processing");

      // Build combined prompt from mode + trigger words
      const prompts: string[] = [];
      if (selectedMode.prompt) {
        prompts.push(selectedMode.prompt);
      }
      for (const trigger of matchingTriggers) {
        prompts.push(trigger.prompt);
      }
      const combinedPrompt = prompts.join('\n\nAdditionally: ');

      const processedText = await processWithAI(
        transcript.trim(),
        combinedPrompt,
        settings.selectedModel,
        settings.openRouterApiKey
      );

      await copyToClipboard(processedText);
      updateStats(processedText);
      closeOverlay();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg.substring(0, 100));
      setState("error");
    }
  }, [state, cleanup, closeOverlay]);

  const startRecording = useCallback(async () => {
    audioChunksRef.current = [];

    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg("Microphone not available");
      setState("error");
      return;
    }

    // Try to request permission via Tauri plugin first (macOS only)
    try {
      const { platform } = await import("@tauri-apps/plugin-os");
      const os = await platform();
      if (os === "macos") {
        const { requestMicrophonePermission } = await import("tauri-plugin-macos-permissions-api");
        await requestMicrophonePermission();
      }
    } catch {
      // Plugin not available, continue with direct access
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioChunksRef.current.push(new Float32Array(inputData));
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = processor;

      setState("recording");
      updateWaveform();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setState("error");
    }
  }, [updateWaveform]);

  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;

  useEffect(() => {
    // Make background transparent for overlay
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    startRecording();

    return () => {
      cleanup();
    };
  }, [startRecording, cleanup]);

  // Separate effect for event listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("stop-recording", () => {
          stopRecordingRef.current();
        });
      } catch (e) {
        // Not in Tauri
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleClick = () => {
    if (state === "recording") {
      stopRecording();
    } else if (state === "error") {
      closeOverlay();
    }
  };

  // Handle ESC key to cancel recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
        closeOverlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cleanup, closeOverlay]);

  return (
    <div
      onClick={handleClick}
      className="flex h-screen w-screen cursor-pointer select-none items-center justify-center"
      style={{ padding: '30px' }}
    >
      <div
        className="flex w-full h-full items-center justify-center"
        style={{
          background: state === "error" ? 'rgba(254, 226, 226, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '20px',
          border: '0.5px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        {state === "idle" && (
          <span className="text-sm text-gray-500">Starting...</span>
        )}
        {state === "recording" && (
          <div className="flex items-center justify-center gap-[3px]">
            {barHeights.map((height, i) => (
              <div
                key={i}
                className="w-[3px] bg-black/80 rounded-full"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
        )}
        {state === "transcribing" && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-[3px] h-4 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-500 ml-1">Transcribing</span>
          </div>
        )}
        {state === "processing" && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-[3px] h-4 bg-violet-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-violet-600 ml-1">Processing</span>
          </div>
        )}
        {state === "error" && (
          <div className="flex items-center gap-2 px-3 max-w-full overflow-hidden">
            <span className="text-red-500 text-lg shrink-0">!</span>
            <span className="text-xs font-medium text-red-600 break-all">{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
