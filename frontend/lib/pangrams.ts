const PANGRAMS = [
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

// All 26 letters for draw mode
export const ALL_LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
