export const PANGRAMS = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "The five boxing wizards jump quickly",
  "Jackdaws love my big sphinx of quartz",
  "Crazy Frederick bought many very exquisite opal jewels",
  "We promptly judged antique ivory buckles for the next prize",
  "A quick movement of the enemy will jeopardize six gunboats",
];

export function getRandomPangram(): string {
  return PANGRAMS[Math.floor(Math.random() * PANGRAMS.length)];
}

export function getUniqueChars(pangram: string): string[] {
  const seen = new Set<string>();
  const chars: string[] = [];
  for (const c of pangram.toLowerCase()) {
    if (/[a-z]/.test(c) && !seen.has(c)) {
      seen.add(c);
      chars.push(c);
    }
  }
  return chars;
}

// All 26 letters + digits + punctuation for draw mode
export const ALL_LETTERS = [..."abcdefghijklmnopqrstuvwxyz", ..."0123456789", ",", ".", "-", "\u2019", "!", "?"];

// ─── Letter categories for typographic guide lines ────────────────────────────

export type LetterCategory = 'x-height' | 'ascender' | 'descender' | 'number' | 'punctuation';

export const LETTER_CATEGORY: Record<string, LetterCategory> = {
  a: 'x-height', c: 'x-height', e: 'x-height', m: 'x-height', n: 'x-height',
  o: 'x-height', r: 'x-height', s: 'x-height', u: 'x-height', v: 'x-height',
  w: 'x-height', x: 'x-height', z: 'x-height',
  b: 'ascender', d: 'ascender', f: 'ascender', h: 'ascender', k: 'ascender',
  l: 'ascender', i: 'ascender', t: 'ascender',
  g: 'descender', j: 'descender', p: 'descender', q: 'descender', y: 'descender',
  '0': 'number', '1': 'number', '2': 'number', '3': 'number', '4': 'number',
  '5': 'number', '6': 'number', '7': 'number', '8': 'number', '9': 'number',
  ',': 'punctuation', '.': 'punctuation', '-': 'punctuation', '\u2019': 'punctuation',
  '!': 'punctuation', '?': 'punctuation',
};

// Canvas guide line positions (fraction of canvas height, top=0)
// Matches font metrics: ASCENDER=800, X_HEIGHT=500, BASELINE=0, DESCENDER=-200
export const GUIDE_LINES = {
  ascender: 0.05,  // 5% from top
  xHeight: 0.31,   // 31% from top
  baseline: 0.75,  // 75% from top
  descender: 0.92, // 92% from top
} as const;
