"use client";

import { Settings, DEFAULT_SETTINGS } from "@/types/settings";

const STORAGE_KEY = "everlast_settings";

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(stored) as Partial<Settings>;

    // Merge with defaults to handle new fields
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      modes: parsed.modes?.length ? parsed.modes : DEFAULT_SETTINGS.modes,
      // Ensure hotkey is a proper object (migrate from old string format)
      hotkey: (parsed.hotkey && typeof parsed.hotkey === 'object' && 'label' in parsed.hotkey)
        ? parsed.hotkey
        : DEFAULT_SETTINGS.hotkey,
      // Ensure stats exists
      stats: parsed.stats || DEFAULT_SETTINGS.stats,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    console.error("Failed to save settings");
  }
}

export function getSelectedMode(settings: Settings) {
  return settings.modes.find(m => m.id === settings.selectedModeId) || settings.modes[0];
}

export function updateStats(text: string): void {
  const settings = getSettings();
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const characters = text.length;

  settings.stats = {
    totalWords: (settings.stats?.totalWords || 0) + words,
    totalRecordings: (settings.stats?.totalRecordings || 0) + 1,
    totalCharacters: (settings.stats?.totalCharacters || 0) + characters,
  };

  saveSettings(settings);
}
