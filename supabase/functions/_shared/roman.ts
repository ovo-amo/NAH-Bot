const NUMERALS: [string, number][] = [
  ["M", 1000],
  ["CM", 900],
  ["D", 500],
  ["CD", 400],
  ["C", 100],
  ["XC", 90],
  ["L", 50],
  ["XL", 40],
  ["X", 10],
  ["IX", 9],
  ["V", 5],
  ["IV", 4],
  ["I", 1],
];

/** Roman numeral for a non-negative integer. Zero is "N" (nulla). */
export function roman(n: number): string {
  n = Math.max(0, Math.floor(n));
  if (n === 0) return "N";
  let out = "";
  for (const [glyph, value] of NUMERALS) {
    while (n >= value) {
      out += glyph;
      n -= value;
    }
  }
  return out;
}
