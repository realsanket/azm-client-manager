const PALETTE = [
  "#E63946",
  "#F77F00",
  "#FCBF49",
  "#43AA8B",
  "#277DA1",
  "#577590",
  "#9D4EDD",
  "#F72585",
  "#06AED5",
  "#B5179E",
] as const;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hueForClient(name: string): string {
  return PALETTE[hash(name.toLowerCase()) % PALETTE.length];
}

export const HUE_PALETTE = PALETTE;
