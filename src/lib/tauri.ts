"use client";

import { getSettings } from "./storage";

// Check if running in Tauri
export const isTauri = (): boolean => {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
};

// Copy text to clipboard via Tauri
export async function copyToClipboard(text: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("copy_to_clipboard", { text });
  } else {
    // Fallback for browser/development
    await navigator.clipboard.writeText(text);
  }
}

// Save audio blob to temp file and return path
export async function saveAudioToTemp(blob: Blob): Promise<string> {
  if (!isTauri()) {
    throw new Error("saveAudioToTemp requires Tauri");
  }

  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const { tempDir } = await import("@tauri-apps/api/path");

  const tempPath = await tempDir();
  const fileName = `everlast_audio_${Date.now()}.wav`;
  const filePath = `${tempPath}${fileName}`;

  // Convert blob to array buffer
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  await writeFile(filePath, uint8Array);

  return filePath;
}

// Get the path to the bundled model
async function getModelPath(): Promise<string> {
  const { resolveResource } = await import("@tauri-apps/api/path");
  return await resolveResource("resources/models/ggml-base.bin");
}

// Run whisper transcription
export async function transcribeWithWhisper(
  audioPath: string
): Promise<string> {
  if (!isTauri()) {
    throw new Error("transcribeWithWhisper requires Tauri");
  }

  const { Command } = await import("@tauri-apps/plugin-shell");

  let modelPath: string;
  try {
    modelPath = await getModelPath();
  } catch (e) {
    throw new Error(`Model path: ${e}`);
  }

  // Get language from settings
  const settings = getSettings();
  const language = settings.language || "auto";

  // Build command args - whisper defaults to English, so we must pass -l for all cases
  const args = ["-m", modelPath, "-f", audioPath, "--no-timestamps", "-l", language];

  const command = Command.sidecar("binaries/whisper", args);

  const output = await command.execute();

  if (output.code !== 0) {
    throw new Error(output.stderr || `Exit ${output.code}`);
  }

  return output.stdout.trim();
}

// High-level function: transcribe audio blob
export async function transcribeAudio(blob: Blob): Promise<string> {
  if (!isTauri()) {
    throw new Error("Not in Tauri");
  }

  // Save audio to temp file
  let audioPath: string;
  try {
    audioPath = await saveAudioToTemp(blob);
  } catch (e) {
    throw new Error(`Save failed: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const transcript = await transcribeWithWhisper(audioPath);
    return transcript;
  } catch (e) {
    throw new Error(`Whisper: ${e instanceof Error ? e.message : e}`);
  } finally {
    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(audioPath);
    } catch {
      // Ignore
    }
  }
}

// Check if whisper binary exists
export async function hasWhisperBinary(): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const { Command } = await import("@tauri-apps/plugin-shell");
    const command = Command.sidecar("binaries/whisper", ["--help"]);
    const output = await command.execute();
    return output.code === 0;
  } catch {
    return false;
  }
}

// Listen for global shortcut events
export async function onGlobalShortcut(
  callback: (shortcut: string) => void
): Promise<() => void> {
  if (!isTauri()) {
    // No-op for browser development
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<string>("global-shortcut", (event) => {
    callback(event.payload);
  });

  return unlisten;
}
