import * as path from "@std/path";
import { existsSync } from "@std/fs";
import { loadProjectConfig } from "./config.ts";
import { logger, runCli } from "./utils.ts";

import { extendedOptions } from "./map-settings-options.ts";
import { patchMapInfo, hasExtendedSettings } from "./map-settings-binary.ts";
import { patchSettingsLua } from "./map-settings-lua.ts";
export { patchMapInfo } from "./map-settings-binary.ts";

type TextOverrides = Record<string, string>;
type Sections = Record<string, TextOverrides>;
export interface MapSettings extends ReturnType<typeof extendedOptions> {
  info: TextOverrides;
  loadingScreen: Record<string, string | number>;
  gameplayConstants: Sections;
  gameInterface: Sections;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

export function validateMapSettings(value: unknown): MapSettings {
  const config = record(value, "Map settings");
  for (const key of Object.keys(config)) {
    if (!["info", "loadingScreen", "gameplayConstants", "gameInterface", "players", "forces", "environment", "gameplay"].includes(key)) throw new Error(`Unknown map setting: ${key}`);
  }
  function fields(group: string, allowed: string[]): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(record(config[group] ?? {}, group))) {
      if (!allowed.includes(key)) throw new Error(`Unknown map setting: ${group}.${key}`);
      if (value === null) continue;
      if (key === "background") {
        if (typeof value !== "number" || !Number.isInteger(value) || value < -1 || value > 2147483647) throw new Error("loadingScreen.background must be an integer from -1 to 2147483647.");
      } else if (typeof value !== "string" || value.includes("\0")) throw new Error(`${group}.${key} must be text without NUL characters.`);
      result[key] = value as string | number;
    }
    return result;
  }
  function sections(group: string): Sections {
    const result: Sections = {};
    const seen = new Set<string>();
    for (const [section, values] of Object.entries(record(config[group] ?? {}, group))) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(section) || seen.has(section.toLowerCase())) throw new Error(`Invalid or duplicate ${group} section: ${section}`);
      seen.add(section.toLowerCase());
      const entries: TextOverrides = Object.create(null);
      const keys = new Set<string>();
      for (const [key, value] of Object.entries(record(values, `${group}.${section}`))) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || keys.has(key.toLowerCase())) throw new Error(`Invalid or duplicate ${group} key: ${key}`);
        if (typeof value !== "string" || /[\r\n\0]/.test(value)) throw new Error(`${group}.${section}.${key} must be a single-line string.`);
        keys.add(key.toLowerCase());
        entries[key] = value;
      }
      Object.defineProperty(result, section, { value: entries, enumerable: true });
    }
    return result;
  }
  return {
    ...extendedOptions(config),
    info: fields("info", ["name", "author", "description", "recommendedPlayers"]) as TextOverrides,
    loadingScreen: fields("loadingScreen", ["background", "model", "text", "title", "subtitle"]),
    gameplayConstants: sections("gameplayConstants"), gameInterface: sections("gameInterface"),
  };
}

export function evaluateMapSettings(root = Deno.cwd()): MapSettings {
  const module = path.join(root, "map-settings.pkl");
  if (!existsSync(module)) return validateMapSettings({});
  const executable = Deno.env.get("PKL_EXECUTABLE") || "pkl";
  let result: Deno.CommandOutput;
  try {
    result = new Deno.Command(executable, { args: ["eval", "-f", "json", module], cwd: root, stdout: "piped", stderr: "piped" }).outputSync();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) throw new Error(`Pkl executable '${executable}' not found. Install Pkl or set PKL_EXECUTABLE.`, { cause: error });
    throw error;
  }
  if (!result.success) throw new Error(`map-settings.pkl evaluation failed:\n${new TextDecoder().decode(result.stderr)}`);
  return validateMapSettings(JSON.parse(new TextDecoder().decode(result.stdout)));
}

/** Merge raw Warcraft section/key values without discarding unrelated editor settings. */
export function patchSettingsText(source: string, sections: Sections): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source ? source.split(/\r?\n/) : [];
  for (const [section, entries] of Object.entries(sections)) {
    for (const [key, value] of Object.entries(entries)) {
      let active = false;
      let insertion = -1;
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        const header = lines[i].match(/^\s*\[([^\]]+)\]\s*(?:\/\/.*)?$/);
        if (header) active = header[1].toLowerCase() === section.toLowerCase();
        if (!active) continue;
        insertion = i + 1;
        const field = lines[i].match(/^(\s*)([^=\s]+)\s*=/);
        if (field && field[2].toLowerCase() === key.toLowerCase()) {
          lines[i] = `${field[1]}${field[2]}=${value}`;
          found = true;
        }
      }
      if (!found) {
        if (insertion === -1) {
          if (lines.length && lines.at(-1) !== "") lines.push("");
          lines.push(`[${section}]`, `${key}=${value}`);
        } else lines.splice(insertion, 0, `${key}=${value}`);
      }
    }
  }
  return lines.join(newline);
}

/** Read-only validation and planning; the build writes the resulting changes to its staged map. */
export function planMapSettings(mapDir: string, value: unknown): { file: string; bytes: Uint8Array }[] {
  const settings = validateMapSettings(value);
  const changes: { file: string; bytes: Uint8Array }[] = [];
  if (Object.keys(settings.info).length || Object.keys(settings.loadingScreen).length || hasExtendedSettings(settings)) {
    const file = path.join(mapDir, "war3map.w3i");
    changes.push({ file, bytes: patchMapInfo(Deno.readFileSync(file), settings) });
  }
  const luaFile = path.join(mapDir, "war3map.lua");
  if (settings.info.name !== undefined || settings.info.description !== undefined || hasExtendedSettings(settings)) {
    const original = Deno.readTextFileSync(luaFile);
    const patched = changes.find(c => c.file.endsWith("war3map.w3i"))!.bytes;
    const lua = patchSettingsLua(original, settings, patched);
    if (lua !== original) changes.push({ file: luaFile, bytes: new TextEncoder().encode(lua) });
  }
  for (const [key, rawKey] of [["heroMaxLevel", "HeroMaxLevel"], ["foodLimit", "FoodCeiling"]]) {
    if (settings.gameplay[key] === undefined) continue;
    const value = String(settings.gameplay[key]);
    const section = Object.keys(settings.gameplayConstants).find(k => k.toLowerCase() === "misc") ?? "Misc";
    const fields = settings.gameplayConstants[section] ??= {};
    const existing = Object.keys(fields).find(k => k.toLowerCase() === rawKey.toLowerCase());
    if (existing && fields[existing] !== value) throw new Error("Conflicting typed and raw gameplay constant: " + rawKey);
    fields[existing ?? rawKey] = value;
  }
  for (const [filename, sections] of [["war3mapMisc.txt", settings.gameplayConstants], ["war3mapSkin.txt", settings.gameInterface]] as const) {
    if (!Object.values(sections).some(entries => Object.keys(entries).length)) continue;
    const file = path.join(mapDir, filename);
    const source = existsSync(file) ? Deno.readTextFileSync(file) : "";
    changes.push({ file, bytes: new TextEncoder().encode(patchSettingsText(source, sections)) });
  }
  return changes;
}

if (import.meta.main) runCli(() => {
  const config = loadProjectConfig();
  const changes = planMapSettings(path.resolve("maps", config.mapFolder), evaluateMapSettings());
  logger.info(`Map settings valid (${changes.length} internal files would be updated during build).`);
});
