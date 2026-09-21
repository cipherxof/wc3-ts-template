/** Offset-based reader: never serialize fields that this tool does not own. */
export interface Field<T> { start: number; end: number; value: T }
export class MapInfoReader {
  offset = 0;
  view: DataView;
  constructor(readonly bytes: Uint8Array) { this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  skip(size: number): void {
    if (this.offset + size > this.bytes.length) throw new Error("Truncated war3map.w3i.");
    this.offset += size;
  }
  number(float = false, size = 4): Field<number> {
    const start = this.offset; this.skip(size);
    return { start, end: this.offset, value: size === 1 ? this.view.getUint8(start) : float ? this.view.getFloat32(start, true) : this.view.getInt32(start, true) };
  }
  text(): Field<string> {
    const start = this.offset;
    const end = this.bytes.indexOf(0, start);
    if (end === -1) throw new Error("Unterminated string in war3map.w3i.");
    this.offset = end + 1;
    return { start, end: this.offset, value: new TextDecoder("utf-8", { fatal: true }).decode(this.bytes.subarray(start, end)) };
  }
}
export function readMapInfo(bytes: Uint8Array, extended = false) {
  const r = new MapInfoReader(bytes);
  const version = r.number().value;
  if (![18, 25, 28, 31, 32, 33, 39].includes(version)) throw new Error(`Unsupported war3map.w3i version: ${version}`);
  r.skip(version >= 28 ? 24 : 8);
  const info = { name: r.text(), author: r.text(), description: r.text(), recommendedPlayers: r.text() };
  r.skip(56);
  const flags = r.number(); r.skip(1);
  const background = r.number();
  // v39 adds a four-byte field BEFORE the model path (observed value 64).
  // It is not text and must survive loading-screen overrides verbatim.
  if (version === 39) r.skip(4);
  const model = version >= 25 ? r.text() : undefined;
  const loadingScreen = { background, model, text: r.text(), title: r.text(), subtitle: r.text() };
  const prefix = { version, info, flags, loadingScreen };
  if (!extended) return { ...prefix, details: undefined };
  if (version < 28) throw new Error("Player, force and environment overrides require a Lua map (w3i version 28 or later).");
  r.skip(4); // game data set
  for (let i = 0; i < 4; i++) r.text(); // prologue
  const fog = { style: r.number(), start: r.number(true), end: r.number(true), density: r.number(true), color: Array.from({ length: 4 }, () => r.number(false, 1)) };
  r.skip(4); // weather
  if (version === 39) r.skip(24); // second fog/environment block; preserve
  const soundEnvironment = r.text(); r.skip(1); // light environment
  const waterColor = Array.from({ length: 4 }, () => r.number(false, 1));
  if (r.number().value !== 1) throw new Error("Map settings require Lua scripting language in war3map.w3i.");
  if (version >= 31) r.skip(8);
  if (version >= 32) r.skip(8);
  if (version >= 33) r.skip(4);
  if (version === 39) r.skip(40); // HD water options and additional environment data
  const playerCount = r.number().value;
  if (playerCount < 1 || playerCount > 24) throw new Error("Invalid player count in war3map.w3i.");
  const players = Array.from({ length: playerCount }, () => {
    const id = r.number(), controller = r.number(), race = r.number();
    if (version === 39) r.skip(4); // race skin preference
    const fixedStart = r.number(), name = r.text(), x = r.number(true), y = r.number(true);
    r.skip(version >= 31 ? 16 : 8); // ally/enemy start-location priorities
    return { id, controller, race, fixedStart, name, x, y };
  });
  if (new Set(players.map(p => p.id.value)).size !== players.length || players.some(p => p.id.value < 0 || p.id.value > 23 || p.controller.value < 1 || p.controller.value > 4 || p.race.value < 0 || p.race.value > 4 || ![0, 1].includes(p.fixedStart.value) || !Number.isFinite(p.x.value) || !Number.isFinite(p.y.value))) throw new Error("Invalid player records in war3map.w3i.");
  const forceCount = r.number().value;
  if (forceCount < 1 || forceCount > 24) throw new Error("Invalid force count in war3map.w3i.");
  const forces = Array.from({ length: forceCount }, () => ({ flags: r.number(), players: r.number(), name: r.text() }));
  return { ...prefix, details: { fog, soundEnvironment, waterColor, players, forces } };
}
export interface ByteEdit { start: number; end: number; bytes: Uint8Array }
export function fieldEdit(field: Field<string> | Field<number>, value: string | number, float = false): ByteEdit {
  let bytes: Uint8Array;
  if (typeof value === "string") bytes = new TextEncoder().encode(value + "\0");
  else {
    bytes = new Uint8Array(field.end - field.start);
    const view = new DataView(bytes.buffer);
    if (bytes.length === 1) view.setUint8(0, value);
    else if (float) view.setFloat32(0, value, true);
    else view.setInt32(0, value, true);
  }
  return { start: field.start, end: field.end, bytes };
}
export function applyByteEdits(source: Uint8Array, edits: ByteEdit[]): Uint8Array {
  edits.sort((a, b) => a.start - b.start);
  const result = new Uint8Array(source.length + edits.reduce((n, e) => n + e.bytes.length - (e.end - e.start), 0));
  let input = 0, output = 0;
  for (const e of edits) {
    if (e.start < input) throw new Error("Overlapping map-info edits.");
    result.set(source.subarray(input, e.start), output); output += e.start - input;
    result.set(e.bytes, output); output += e.bytes.length; input = e.end;
  }
  result.set(source.subarray(input), output);
  return result;
}
