/** Strict reader/writer for the World Editor import index (war3map.imp v1). */
export interface ImportEntry { flag: number; path: string; }

export function importPath(entry: ImportEntry): string {
  return entry.flag === 10 || entry.flag === 13 ? entry.path : `war3mapImported\\${entry.path}`;
}

export function readImports(bytes: Uint8Array): ImportEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 8 || view.getUint32(0, true) !== 1) throw new Error("Unsupported or truncated war3map.imp (expected version 1).");
  const count = view.getUint32(4, true);
  const entries: ImportEntry[] = [];
  let offset = 8;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let i = 0; i < count; i++) {
    const flag = bytes[offset++];
    if (![0, 5, 8, 10, 13].includes(flag)) throw new Error("Invalid import flag in war3map.imp.");
    const end = bytes.indexOf(0, offset);
    if (end < offset) throw new Error("Truncated path in war3map.imp.");
    const value = decoder.decode(bytes.subarray(offset, end));
    if (!value) throw new Error("Empty path in war3map.imp.");
    entries.push({ flag, path: value });
    offset = end + 1;
  }
  if (offset !== bytes.length) throw new Error("Unexpected trailing data in war3map.imp.");
  return entries;
}

export function writeImports(entries: ImportEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const paths = entries.map(entry => encoder.encode(entry.path));
  const bytes = new Uint8Array(8 + paths.reduce((size, value) => size + value.length + 2, 0));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 1, true);
  view.setUint32(4, entries.length, true);
  let offset = 8;
  entries.forEach((entry, i) => {
    bytes[offset++] = entry.flag;
    bytes.set(paths[i], offset);
    offset += paths[i].length + 1;
  });
  return bytes;
}
