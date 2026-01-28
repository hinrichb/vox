export interface Mode {
  id: string;
  name: string;
  prompt: string;
  isDefault?: boolean;
}

export interface Stats {
  totalWords: number;
  totalRecordings: number;
  totalCharacters: number;
}

export interface Settings {
  language: string;
  openRouterApiKey: string;
  selectedModel: string;
  selectedModeId: string;
  modes: Mode[];
  hotkey: HotkeyConfig;
  stats: Stats;
}

export interface HotkeyConfig {
  modifiers: string[];
  key: string;
  label: string;
}

export const AVAILABLE_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Best quality' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Balanced' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', description: 'Very fast' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Open source' },
] as const;

export const DEFAULT_MODES: Mode[] = [
  { id: 'normal', name: 'Normal', prompt: '', isDefault: true },
  { id: 'fix-grammar', name: 'Fix Grammar', prompt: 'Fix any grammar and spelling mistakes in the following text. Keep the same language. Return only the corrected text, nothing else.' },
  { id: 'translate-en', name: 'Translate to English', prompt: 'Translate the following text to English. Return only the translation, nothing else.' },
];

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  openRouterApiKey: '',
  selectedModel: 'openai/gpt-4o-mini',
  selectedModeId: 'normal',
  modes: DEFAULT_MODES,
  hotkey: { modifiers: ['Alt'], key: 'M', label: 'Option + M' },
  stats: { totalWords: 0, totalRecordings: 0, totalCharacters: 0 },
};

export const LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'de', name: 'German' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
] as const;
