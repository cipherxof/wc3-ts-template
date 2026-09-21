import { createRequire } from "node:module";
import { readMapInfo } from "./map-info.ts";
import type { MapSettings } from "./settings.ts";
import { hasExtendedSettings } from "./binary.ts";
import { forceBits } from "./options.ts";

// Use the same parser as the existing Lua minifier. AST ranges keep strings,
// comments, nested blocks and unrelated user initialization intact.
const parser = createRequire(import.meta.resolve("luamin"))("luaparse");
interface Node {
  type: string; name?: string; value?: number; range: [number, number];
  identifier?: Node; expression?: Node; base?: Node; arguments?: Node[]; body?: Node[];
}
export function luaString(value: string): string {
  // Escape control bytes intentionally; JSON's \u escapes are not Lua escapes.
  // deno-lint-ignore no-control-regex
  return '"' + value.replace(/[\\"\x00-\x1f\x7f]/g, c => c === '"' || c === "\\" ? "\\" + c : "\\" + c.charCodeAt(0).toString().padStart(3, "0")) + '"';
}
export function patchSettingsLua(source: string, settings: MapSettings, bytes: Uint8Array): string {
  const tree = parser.parse(source, { ranges: true, luaVersion: "5.3" }) as Node;
  const edits: { start: number; end: number; text: string }[] = [];
  const additions = new Map<Node, string[]>();
  function fn(name: string): Node {
    const matches = tree.body!.filter(n => n.type === "FunctionDeclaration" && n.identifier?.name === name);
    if (matches.length !== 1) throw new Error(`Map settings require one editor-generated ${name}() function.`);
    return matches[0];
  }
  function call(n: Node): Node | undefined { return n.type === "CallStatement" ? n.expression : undefined; }
  function named(n: Node, name: string): boolean { return call(n)?.base?.name === name; }
  function add(f: Node, text: string): void { additions.set(f, [...(additions.get(f) ?? []), text]); }
  function requireCall(f: Node, name: string): void {
    if (f.body!.filter(n => named(n, name)).length !== 1) throw new Error(`Map settings require one ${name}() call in ${f.identifier?.name}().`);
  }
  function replace(f: Node, name: string, text: string, player?: number, optional = false): void {
    const matches = f.body!.filter(n => {
      if (!named(n, name)) return false;
      if (player === undefined) return true;
      const p = call(n)?.arguments?.[0];
      return p?.base?.name === "Player" && p.arguments?.[0]?.value === player;
    });
    if (matches.length > 1 || (!optional && !matches.length)) throw new Error(`Cannot safely update ${name} in ${f.identifier?.name}: expected one editor call.`);
    if (!matches.length) { if (text) add(f, text); return; }
    edits.push({ start: matches[0].range[0], end: matches[0].range[1], text });
  }
  if (settings.info.name !== undefined) replace(fn("config"), "SetMapName", `SetMapName(${luaString(settings.info.name)})`);
  if (settings.info.description !== undefined) replace(fn("config"), "SetMapDescription", `SetMapDescription(${luaString(settings.info.description)})`);
  if (hasExtendedSettings(settings)) {
    const map = readMapInfo(bytes, true), d = map.details!;
    for (const [id, options] of Object.entries(settings.players)) {
      requireCall(fn("config"), "InitCustomPlayerSlots");
      const f = fn("InitCustomPlayerSlots"), p = d.players.find(p => p.id.value === +id)!;
      const index = d.players.indexOf(p);
      const start = f.body!.filter(n => named(n, "SetPlayerStartLocation") && call(n)?.arguments?.[0]?.base?.name === "Player" && call(n)?.arguments?.[0]?.arguments?.[0]?.value === +id);
      if (start.length !== 1 || call(start[0])?.arguments?.[1]?.value !== index) throw new Error(`Player ${id} start location disagrees between map info and Lua.`);
      if (options.controller !== undefined) replace(f, "SetPlayerController", `SetPlayerController(Player(${id}), ${["", "MAP_CONTROL_USER", "MAP_CONTROL_COMPUTER", "MAP_CONTROL_NEUTRAL", "MAP_CONTROL_RESCUABLE"][p.controller.value]})`, +id);
      if (options.race !== undefined) {
        replace(f, "SetPlayerRacePreference", `SetPlayerRacePreference(Player(${id}), ${["RACE_PREF_USER_SELECTABLE", "RACE_PREF_HUMAN", "RACE_PREF_ORC", "RACE_PREF_UNDEAD", "RACE_PREF_NIGHTELF"][p.race.value]})`, +id);
        replace(f, "SetPlayerRaceSelectable", `SetPlayerRaceSelectable(Player(${id}), ${p.race.value === 0})`, +id);
      }
      if (options.name !== undefined) replace(f, "SetPlayerName", `SetPlayerName(Player(${id}), ${luaString(options.name)})`, +id, true);
      if (options.fixedStart !== undefined) replace(f, "ForcePlayerStartLocation", options.fixedStart ? `ForcePlayerStartLocation(Player(${id}), ${index})` : "", +id, true);
      if (options.x !== undefined || options.y !== undefined) {
        const matches = fn("config").body!.filter(n => named(n, "DefineStartLocation") && call(n)!.arguments?.[0]?.value === index);
        if (matches.length !== 1) throw new Error(`Cannot find start location ${index} in config().`);
        edits.push({ start: matches[0].range[0], end: matches[0].range[1], text: `DefineStartLocation(${index}, ${p.x.value}, ${p.y.value})` });
      }
    }
    for (const [index, options] of Object.entries(settings.forces)) {
      if (!Object.keys(forceBits).some(k => k in options)) continue;
      requireCall(fn("config"), "InitCustomTeams");
      const f = fn("InitCustomTeams"), force = d.forces[+index];
      const members = d.players.filter(p => (force.players.value & (1 << p.id.value)) !== 0).map(p => p.id.value);
      for (const p of members) {
        const team = f.body!.filter(n => named(n, "SetPlayerTeam") && call(n)?.arguments?.[0]?.base?.name === "Player" && call(n)?.arguments?.[0]?.arguments?.[0]?.value === p);
        if (team.length !== 1 || call(team[0])?.arguments?.[1]?.value !== +index) throw new Error(`Player ${p} force disagrees between map info and Lua.`);
      }
      const flags = force.flags.value;
      for (const p of members) {
        add(f, `SetPlayerState(Player(${p}), PLAYER_STATE_ALLIED_VICTORY, ${(flags & 2) ? 1 : 0})`);
        for (const q of members) if (p !== q) {
          add(f, `SetPlayerAllianceStateAllyBJ(Player(${p}), Player(${q}), ${!!(flags & 1)})`);
          for (const [bit, name] of [[8, "SHARED_VISION"], [16, "SHARED_CONTROL"], [32, "SHARED_ADVANCED_CONTROL"]] as const) add(f, `SetPlayerAlliance(Player(${p}), Player(${q}), ALLIANCE_${name}, ${!!(flags & bit)})`);
        }
      }
    }
    const e = settings.environment;
    if (Object.keys(e).length) {
      const f = fn("main");
      const anchor = f.body!.find(n => named(n, "CreateAllUnits") || named(n, "InitBlizzard"));
      if (!anchor) throw new Error("Environment settings require an editor initialization anchor in main().");
      const lines: string[] = [];
      const environmentCall = (name: string, text: string) => {
        for (const n of f.body!.filter(n => named(n, name))) edits.push({ start: n.range[0], end: n.range[1], text: "" });
        lines.push(text);
      };
      if (e.soundEnvironment !== undefined) environmentCall("NewSoundEnvironment", `NewSoundEnvironment(${luaString(e.soundEnvironment || "Default")})`);
      if (e.waterColor) environmentCall("SetWaterBaseColor", `SetWaterBaseColor(${e.waterColor.join(", ")})`);
      if (e.fog) {
        const fog = d.fog;
        environmentCall("SetTerrainFogEx", (map.flags.value & 0x2000) ? `SetTerrainFogEx(${fog.style.value}, ${fog.start.value}, ${fog.end.value}, ${fog.density.value}, ${fog.color.slice(0, 3).map(c => c.value / 255).join(", ")})` : "ResetTerrainFog()");
      }
      edits.push({ start: anchor.range[0], end: anchor.range[0], text: lines.join("\n") + "\n" });
    }
  }
  for (const [f, lines] of additions) edits.push({ start: f.range[1] - 3, end: f.range[1] - 3, text: lines.join("\n") + "\n" });
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) source = source.slice(0, e.start) + e.text + source.slice(e.end);
  parser.parse(source, { luaVersion: "5.3" });
  return source;
}
