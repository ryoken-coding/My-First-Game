import { en, type Dict } from './en';
import { pt } from './pt';
import { es } from './es';
import { fr } from './fr';
import { de } from './de';
import { ja } from './ja';
import { ko } from './ko';
import { zh } from './zh';

export type LangCode = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'zh';

export const LANGUAGES: { code: LangCode; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '简体中文' },
];

const dicts: Record<LangCode, Dict> = { en, pt, es, fr, de, ja, ko, zh };
let current: LangCode = 'en';

/** Sets the active language. Unknown codes fall back to English. */
export function setLang(code: string): void {
  current = (code in dicts ? code : 'en') as LangCode;
  document.documentElement.lang = current === 'zh' ? 'zh-Hans' : current;
}

export function getLang(): LangCode {
  return current;
}

/** Whole typed dictionary for the active language (structured content). */
export function L(): Dict {
  return dicts[current];
}

function lookup(dict: unknown, path: string): unknown {
  let node: unknown = dict;
  for (const part of path.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return node;
}

/**
 * Translate a dotted key, e.g. t('ui.health'). Interpolates {name} placeholders.
 * Missing keys fall back to English and finally to the key itself (visible in dev).
 */
export function t(path: string, vars?: Record<string, string | number>): string {
  let value = lookup(dicts[current], path);
  if (typeof value !== 'string') value = lookup(en, path);
  if (typeof value !== 'string') return path;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Translate a key that resolves to a list of strings (e.g. text size names). */
export function tList(path: string): string[] {
  const v = lookup(dicts[current], path);
  if (Array.isArray(v)) return v as string[];
  const fb = lookup(en, path);
  return Array.isArray(fb) ? (fb as string[]) : [];
}
