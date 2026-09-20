import * as path from "@std/path";
import { createHash } from "node:crypto";
import { loadProjectConfig } from "./config.ts";
import { importPath, readImports, writeImports } from "./asset-imports.ts";
import { logger, runCli } from "./utils.ts";

export interface AssetConfig { paths: Record<string, string>; exclude: string[]; }
export interface Asset { source: string; target: string; bytes: Uint8Array; hash: string; }
interface State { version: 1; files: Record<string, string>; }
interface Change { file: string; before?: Uint8Array; after?: Uint8Array; }
export interface AssetPlan { assets: Asset[]; changes: Change[]; state: State; }
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const key = (value: string) => value.replaceAll("\\", "/").toLowerCase();
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** A portable relative file path: never let asset or state data escape its root. */
export function assetPath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (!normalized || segments.some(segment => !segment || segment === "." || segment === ".." ||
    [...segment].some(char => char.charCodeAt(0) < 32) || /[<>:"|?*]/.test(segment) || /[. ]$/.test(segment) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) {
    throw new Error(`Invalid asset path: ${value}`);
  }
  return normalized;
}

function targetPath(value: string): string {
  const normalized = assetPath(value);
  if (/^(?:war3map|war3campaign|\(listfile\)|\(attributes\)|\(signature\))/i.test(normalized) &&
    !/^war3mapImported\//i.test(normalized) || /^scripts\/war3map\./i.test(normalized)) {
    throw new Error(`Reserved map path: ${value}`);
  }
  return normalized;
}

function stat(file: string): Deno.FileInfo | undefined {
  try { return Deno.lstatSync(file); }
  catch (error) { if (error instanceof Deno.errors.NotFound) return; throw error; }
}

/** Check every existing component, including directories, before reading/writing. */
function safeJoin(root: string, relative: string): string {
  let current = path.resolve(root);
  if (stat(current)?.isSymlink) throw new Error(`Symlinks are not supported: ${current}`);
  for (const segment of assetPath(relative).split("/")) {
    current = path.join(current, segment);
    if (stat(current)?.isSymlink) throw new Error(`Symlinks are not supported: ${current}`);
  }
  return current;
}

function scan(root: string): Map<string, string> {
  const result = new Map<string, string>();
  const seen = new Set<string>();
  const rootInfo = stat(root);
  if (!rootInfo) return result;
  if (!rootInfo.isDirectory || rootInfo.isSymlink) throw new Error(`Expected a directory without symlinks: ${root}`);
  function visit(relative: string): void {
    const directory = relative ? safeJoin(root, relative) : root;
    for (const entry of [...Deno.readDirSync(directory)].sort((a, b) => compare(a.name, b.name))) {
      const name = assetPath(relative ? `${relative}/${entry.name}` : entry.name);
      if (seen.has(key(name))) throw new Error(`Case-insensitive path collision: ${name}`);
      seen.add(key(name));
      if (entry.isSymlink) throw new Error(`Symlinks are not supported: ${name}`);
      if (entry.isDirectory) visit(name);
      else if (entry.isFile) result.set(key(name), name);
      else throw new Error(`Not a regular file: ${name}`);
    }
  }
  visit("");
  return result;
}

export function validateAssetConfig(value: unknown): AssetConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Asset configuration must be an object.");
  const config = value as Record<string, unknown>;
  if (Object.keys(config).some(k => !["paths", "exclude"].includes(k))) throw new Error("Unknown asset configuration property.");
  const paths = config.paths ?? {};
  const exclude = config.exclude ?? [];
  if (!paths || typeof paths !== "object" || Array.isArray(paths) || Object.values(paths).some(p => typeof p !== "string")) throw new Error("assets.paths must map source paths to target paths.");
  if (!Array.isArray(exclude) || exclude.some(p => typeof p !== "string")) throw new Error("assets.exclude must contain paths.");
  return { paths: paths as Record<string, string>, exclude };
}

export function evaluateAssetConfig(root = Deno.cwd()): AssetConfig {
  const module = safeJoin(root, "assets.pkl");
  if (!stat(module)) return { paths: {}, exclude: [] };
  const executable = Deno.env.get("PKL_EXECUTABLE") || "pkl";
  let result: Deno.CommandOutput;
  try {
    result = new Deno.Command(executable, { args: ["eval", "-f", "json", module], cwd: root, stdout: "piped", stderr: "piped" }).outputSync();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) throw new Error(`Pkl executable '${executable}' not found. Install Pkl or set PKL_EXECUTABLE.`, { cause: error });
    throw error;
  }
  if (!result.success) throw new Error(`assets.pkl evaluation failed:\n${new TextDecoder().decode(result.stderr)}`);
  return validateAssetConfig(JSON.parse(new TextDecoder().decode(result.stdout)));
}

export function collectAssets(root: string, config: AssetConfig): Asset[] {
  config = validateAssetConfig(config);
  const directory = safeJoin(root, "assets");
  const files = scan(directory);
  const exclusions = config.exclude.map(value => ({ prefix: /[\\/]$/.test(value), path: key(assetPath(value.replace(/[\\/]$/, ""))) }));
  const excluded = (name: string) => name.split("/").some(part => part.startsWith(".")) || exclusions.some(e => name === e.path || e.prefix && name.startsWith(e.path + "/"));
  const mappings = new Map<string, string>();
  for (const [source, destination] of Object.entries(config.paths)) {
    const sourceKey = key(assetPath(source));
    if (!files.has(sourceKey)) throw new Error(`Mapped asset does not exist: ${source}`);
    if (excluded(sourceKey)) throw new Error(`Mapped asset is excluded: ${source}`);
    if (mappings.has(sourceKey)) throw new Error(`Duplicate asset mapping: ${source}`);
    mappings.set(sourceKey, targetPath(destination));
  }
  const targets = new Set<string>();
  const assets: Asset[] = [];
  for (const [fileKey, source] of files) {
    if (excluded(fileKey)) continue;
    const target = mappings.get(fileKey) ?? targetPath(source);
    if (targets.has(key(target))) throw new Error(`Asset target collision: ${target}`);
    targets.add(key(target));
    const bytes = Deno.readFileSync(safeJoin(directory, source));
    assets.push({ source, target, bytes, hash: hash(bytes) });
  }
  for (const target of targets) {
    const parts = target.split("/");
    while (parts.length > 1) {
      parts.pop();
      if (targets.has(parts.join("/"))) throw new Error(`Asset file/directory collision: ${target}`);
    }
  }
  return assets.sort((a, b) => compare(key(a.target), key(b.target)));
}

function readState(filename: string): State {
  if (!stat(filename)) return { version: 1, files: {} };
  const state = JSON.parse(Deno.readTextFileSync(filename));
  if (state?.version !== 1 || !state.files || typeof state.files !== "object" || Array.isArray(state.files)) throw new Error("Invalid asset sync state.");
  const seen = new Set<string>();
  for (const [name, digest] of Object.entries(state.files)) {
    targetPath(name);
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest) || seen.has(key(name))) throw new Error(`Invalid asset sync state entry: ${name}`);
    seen.add(key(name));
  }
  return state;
}

/** Pure preflight: inspect all assets, imports and managed files before any mutation. */
export function planAssets(root: string, mapDir: string, stateFile: string, config: AssetConfig): AssetPlan {
  const assets = collectAssets(root, config);
  const files = scan(mapDir);
  if (!stat(mapDir)?.isDirectory) throw new Error(`Map directory does not exist: ${mapDir}`);
  const previous = readState(stateFile);
  const managed = new Map(Object.entries(previous.files).map(([name, digest]) => [key(name), { name, digest }]));
  const impFile = safeJoin(mapDir, files.get("war3map.imp") ?? "war3map.imp");
  const impBytes = stat(impFile) ? Deno.readFileSync(impFile) : undefined;
  const imports = impBytes ? readImports(impBytes) : [];
  const importKeys = new Set<string>();
  for (const entry of imports) {
    const name = key(assetPath(importPath(entry)));
    if (importKeys.has(name)) throw new Error(`Duplicate import path: ${name}`);
    importKeys.add(name);
  }
  const changes: Change[] = [];
  // Verify *all* formerly managed files, including files scheduled for deletion.
  for (const [name, entry] of managed) {
    const current = files.get(name);
    if (current && hash(Deno.readFileSync(safeJoin(mapDir, current))) !== entry.digest) {
      throw new Error(`Managed asset was modified in the map: ${current}. Move or restore it before syncing.`);
    }
  }
  const desired = new Set(assets.map(asset => key(asset.target)));
  const plannedDirectories = new Map<string, string>();
  for (const asset of assets) {
    const name = key(asset.target);
    if (!managed.has(name) && (files.has(name) || importKeys.has(name))) throw new Error(`Asset conflicts with an existing map file/import: ${asset.target}`);
    // Reuse existing path spelling, including directory case, on all platforms.
    const parts = asset.target.split("/");
    let relative = "";
    for (let i = 0; i < parts.length; i++) {
      const parent = relative ? safeJoin(mapDir, relative) : mapDir;
      const info = stat(parent);
      if (info && !info.isDirectory) throw new Error(`Asset parent is not a directory: ${relative}`);
      const existing = info ? [...Deno.readDirSync(parent)].find(e => key(e.name) === key(parts[i])) : undefined;
      if (existing?.isSymlink) throw new Error(`Symlinks are not supported: ${existing.name}`);
      const directoryKey = key(relative ? `${relative}/${parts[i]}` : parts[i]);
      const segment = existing?.name ?? plannedDirectories.get(directoryKey) ?? parts[i];
      relative = relative ? `${relative}/${segment}` : segment;
      if (i < parts.length - 1) plannedDirectories.set(directoryKey, segment);
    }
    const file = safeJoin(mapDir, relative);
    if (stat(file)?.isDirectory) throw new Error(`Asset target is a directory: ${asset.target}`);
    const before = stat(file) ? Deno.readFileSync(file) : undefined;
    if (!before || hash(before) !== asset.hash) changes.push({ file, before, after: asset.bytes });
    asset.target = relative;
  }
  for (const name of managed.keys()) {
    const current = files.get(name);
    if (!desired.has(name) && current) {
      const file = safeJoin(mapDir, current);
      changes.push({ file, before: Deno.readFileSync(file) });
    }
  }
  const merged = imports.filter(entry => !managed.has(key(importPath(entry))));
  merged.push(...assets.map(asset => ({ flag: 13, path: asset.target.replaceAll("/", "\\") })));
  // Leave absent or existing indices untouched for a completely unmanaged empty plan.
  if (assets.length || managed.size) {
    const after = writeImports(merged);
    if (!impBytes || hash(after) !== hash(impBytes)) changes.push({ file: impFile, before: impBytes, after });
  }
  return { assets, changes, state: { version: 1, files: Object.fromEntries(assets.map(asset => [asset.target, asset.hash])) } };
}

/** Roll back file contents on ordinary I/O failures. Run without concurrent editor/build writes. */
export function applyAssetPlan(plan: AssetPlan, stateFile?: string): void {
  const changes = [...plan.changes];
  if (stateFile) {
    const before = stat(stateFile) ? Deno.readFileSync(stateFile) : undefined;
    const after = new TextEncoder().encode(JSON.stringify(plan.state, null, 2) + "\n");
    if (!before || hash(before) !== hash(after)) changes.push({ file: stateFile, before, after });
  }
  const applied: Change[] = [];
  try {
    for (const change of changes) {
      const current = stat(change.file) ? Deno.readFileSync(change.file) : undefined;
      if (current && !change.before || !current && change.before || current && change.before && hash(current) !== hash(change.before)) throw new Error(`File changed after asset preflight: ${change.file}`);
      applied.push(change);
      if (change.after) {
        Deno.mkdirSync(path.dirname(change.file), { recursive: true });
        Deno.writeFileSync(change.file, change.after);
      } else Deno.removeSync(change.file);
    }
  } catch (error) {
    const failures: unknown[] = [error];
    for (const change of applied.reverse()) {
      try {
        if (change.before) Deno.writeFileSync(change.file, change.before);
        else if (stat(change.file)) Deno.removeSync(change.file);
      } catch (rollbackError) { failures.push(rollbackError); }
    }
    if (failures.length > 1) throw new AggregateError(failures, "Asset sync failed and rollback was incomplete. Restore from version control before retrying.");
    throw error;
  }
}

export function assetLocations(root: string, mapFolder: string) {
  if (assetPath(mapFolder).includes("/") || !/\.w3x$/i.test(mapFolder)) throw new Error("Invalid map folder for assets.");
  return { mapDir: safeJoin(root, `maps/${mapFolder}`), stateFile: safeJoin(root, `.asset-state/${mapFolder}.json`) };
}

function main(): void {
  const mode = Deno.args[0];
  if (!["check", "sync"].includes(mode) || Deno.args.length !== 1) throw new Error("Usage: deno run -A scripts/assets.ts check|sync");
  const root = Deno.cwd();
  const { mapDir, stateFile } = assetLocations(root, loadProjectConfig(root).mapFolder);
  for (const name of ["war3map.lua", "war3map.w3i"]) {
    if (!stat(safeJoin(mapDir, name))?.isFile) throw new Error(`Source map is missing ${name}. Use a complete unpacked Lua map.`);
  }
  const plan = planAssets(root, mapDir, stateFile, evaluateAssetConfig(root));
  for (const asset of plan.assets) console.log(`${asset.source} -> ${asset.target.replaceAll("/", "\\")}`);
  if (mode === "sync") {
    console.log("Syncing source-map imports. The map must be closed in World Editor.");
    applyAssetPlan(plan, stateFile);
    logger.info(`Synced ${plan.assets.length} assets (${plan.changes.length} map-file changes). Reopen the map in World Editor.`);
  } else console.log(`Validated ${plan.assets.length} assets; ${plan.changes.length} map-file changes planned. No files changed.`);
}

if (import.meta.main) runCli(main);
