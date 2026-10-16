// Persistent settings and savegame storage (localStorage, with graceful fallback).
import type { LangCode } from '../i18n';

export interface Settings {
  lang: LangCode;
  textScale: number; // index into TEXT_SCALES
  reducedMotion: boolean;
  muted: boolean;
  volume: number; // 0..100
  zoom: number; // 2 or 3 (pixel scale)
  showHints: boolean;
  highContrast: boolean;
  atelierMock: boolean; // mock-unlocked Atelier Pass (no payment)
}

export const TEXT_SCALES = [0.9, 1, 1.18, 1.35];

const SETTINGS_KEY = 'ley.settings.v1';
const SAVE_KEY = 'ley.save.v1';

function detectLang(): LangCode {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('de')) return 'de';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('ko')) return 'ko';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

export const defaultSettings = (): Settings => ({
  lang: detectLang(),
  textScale: 1,
  reducedMotion: false,
  muted: false,
  volume: 60,
  zoom: 2,
  showHints: true,
  highContrast: false,
  atelierMock: false,
});

export function loadSettings(): Settings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore corrupt settings */
  }
  return base;
}

export function saveSettings(s: Settings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function readSave<T>(): T | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSave(data: unknown): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function eraseSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export const storageOk = (): boolean => {
  try {
    const k = '__probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
};
