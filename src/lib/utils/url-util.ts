import type { CustomLink } from '@/types/custom-link';
import { LINK_TYPES } from '@/types/custom-link';

const DEFAULT_IMAGES: Record<CustomLink, string> = {
  [LINK_TYPES.PLANETS]: '/assets/logo_planets.png',
  [LINK_TYPES.MOODLE]: '/assets/moodle.png',
  [LINK_TYPES.NOTEBOOK_LM]: '/assets/notebooklm.png',
  [LINK_TYPES.SPOTIFY]: '/assets/spotify.png',
  [LINK_TYPES.YOUTUBE]: '/assets/youtube.webp',
  [LINK_TYPES.CHATGPT]: '/assets/logo_openai.png',
  [LINK_TYPES.CUSTOM]: '/assets/pochita.webp',
};

function isCustomLink(value: unknown): value is CustomLink {
  return typeof value === 'string' && (Object.values(LINK_TYPES) as string[]).includes(value as string);
}

export function getDefaultImageFor(value: unknown): string {
  if (isCustomLink(value)) {
    return DEFAULT_IMAGES[value];
  }
  return DEFAULT_IMAGES[LINK_TYPES.CUSTOM];
}

export function buildPlanETSUrl(courseCode: string, term: string): string {
  return `https://planets.etsmtl.ca/public/Contenu.aspx?session=${encodeURIComponent(term)}&sigle=${encodeURIComponent(courseCode)}&groupe=00`;
}

const DANGEROUS_SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:/i;

export const isSafeHttpUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }
  // Reject any non-http(s) scheme (javascript:, data:, vbscript:, blob:, file:, …).
  if (DANGEROUS_SCHEME_PATTERN.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  return /^https?:\/\//i.test(trimmed);
};

export const validateUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  // Reject dangerous schemes outright — even "javascript:alert(1).foo" contains a dot.
  if (DANGEROUS_SCHEME_PATTERN.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  // Check if it already has a protocol
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // For URLs without protocol, validate as https://<input> with a real hostname.
  try {
    const parsed = new URL(`https://${trimmed}`);
    return parsed.hostname.includes('.');
  } catch {
    return false;
  }
};

/**
 * Normalizes a URL by ensuring it has a proper protocol
 * If no protocol is provided, defaults to https://
 * Dangerous schemes (javascript:, data:, …) are returned unchanged so that
 * validateUrl/isSafeHttpUrl reject them — never rendered as clickable links.
 */
export const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  // If already has protocol, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Refuse to normalize dangerous schemes into clickable URLs.
  if (DANGEROUS_SCHEME_PATTERN.test(trimmed)) {
    return trimmed;
  }

  // Add https:// by default
  return `https://${trimmed}`;
};
