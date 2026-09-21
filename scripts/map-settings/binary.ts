import { readMapInfo, fieldEdit, applyByteEdits, type ByteEdit } from "./map-info.ts";
import { controllers, races, forceBits } from "./options.ts";
import type { MapSettings } from "./settings.ts";

export function hasExtendedSettings(s: MapSettings): boolean {
  return !!(Object.keys(s.players).length || Object.keys(s.forces).length || Object.keys(s.environment).length);
}
/** Replace known fields and preserve every unrelated byte. */
export function patchMapInfo(bytes: Uint8Array, settings: MapSettings): Uint8Array {
  const extended = hasExtendedSettings(settings);
  if (!extended && !Object.keys(settings.info).length && !Object.keys(settings.loadingScreen).length) return bytes;
  const map = readMapInfo(bytes, extended);
  const edits: ByteEdit[] = [];
  for (const [key, value] of Object.entries(settings.info)) edits.push(fieldEdit(map.info[key as keyof typeof map.info], value));
  for (const [key, value] of Object.entries(settings.loadingScreen)) {
    const field = map.loadingScreen[key as keyof typeof map.loadingScreen];
    if (!field) throw new Error("Custom loading-screen models require w3i version 25 or later.");
    edits.push(fieldEdit(field, value));
  }
  if (map.details) {
    const d = map.details;
    let flags = map.flags.value;
    for (const [id, values] of Object.entries(settings.players)) {
      const p = d.players.find(p => p.id.value === +id);
      if (!p) throw new Error(`Player ${id} does not exist in the source map.`);
      for (const [key, value] of Object.entries(values)) {
        const numeric = key === "controller" ? controllers.indexOf(value as string) : key === "race" ? races.indexOf(value as string) : typeof value === "boolean" ? +value : value;
        edits.push(fieldEdit(p[key as keyof typeof p], numeric, key === "x" || key === "y"));
      }
    }
    for (const [index, values] of Object.entries(settings.forces)) {
      const f = d.forces[+index];
      if (!f) throw new Error(`Force ${index} does not exist in the source map.`);
      if (!(flags & 0x40)) throw new Error("Force overrides require custom forces enabled in the source map.");
      if (values.name !== undefined) edits.push(fieldEdit(f.name, values.name));
      let bits = f.flags.value;
      for (const [key, bit] of Object.entries(forceBits)) {
        const value = values[key as keyof typeof forceBits];
        if (value !== undefined) bits = value ? bits | bit : bits & ~bit;
      }
      edits.push(fieldEdit(f.flags, bits));
    }
    const e = settings.environment;
    if (e.soundEnvironment !== undefined) edits.push(fieldEdit(d.soundEnvironment, e.soundEnvironment));
    if (e.waterColor) {
      flags |= 0x10000;
      e.waterColor.forEach((v, i) => edits.push(fieldEdit(d.waterColor[i], v)));
    }
    if (e.fog) {
      if (e.fog.enabled !== undefined) flags = e.fog.enabled ? flags | 0x2000 : flags & ~0x2000;
      for (const key of ["style", "start", "end", "density"] as const) if (e.fog[key] !== undefined) edits.push(fieldEdit(d.fog[key], e.fog[key]!, key !== "style"));
      if ((e.fog.start ?? d.fog.start.value) > (e.fog.end ?? d.fog.end.value)) throw new Error("Fog start must not exceed fog end.");
      e.fog.color?.forEach((v, i) => edits.push(fieldEdit(d.fog.color[i], v)));
    }
    if (flags !== map.flags.value) edits.push(fieldEdit(map.flags, flags));
  }
  return applyByteEdits(bytes, edits);
}
