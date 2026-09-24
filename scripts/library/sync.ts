// Map libraries: TypeScript packages from JSR that are compiled into the map.
//
// TypeScriptToLua needs a library's TypeScript sources at a path TypeScript can resolve, and it
// must compile them as part of the map so that only imported files are bundled. Deno's cache
// stores JSR files under hashed names, so `deno task lib:sync` copies each library listed in
// config.json "libraries" into .lib/<@scope>/<name>/ (git-ignored) and maps its exports in
// tsconfig.json "paths". Those entries don't contain a version, so upgrading a library doesn't
// change tsconfig.json. The package is never listed in tsconfig "include".
//
// Sources: the version locked in deno.lock, downloaded from JSR (checked against the registry's
// checksums), or a local checkout linked through deno.json "links" (always re-copied).
import * as path from "@std/path";
import * as posix from "@std/path/posix";
import { existsSync } from "@std/fs";
import { loadProjectConfig } from "../shared/config.ts";
import { logger } from "../shared/utils.ts";

export const LIB_DIR = ".lib";
const STAMP = ".sync.json";

interface Stamp {
  name: string;
  source: string; // "jsr:<version>" or "link:<path>"
  exports: Record<string, string>;
}

interface TsConfigPaths {
  compilerOptions: { paths?: Record<string, string[]> };
}

function readJson<T>(file: string): T {
  return JSON.parse(Deno.readTextFileSync(file)) as T;
}

function registry(): string {
  return (Deno.env.get("JSR_URL") ?? "https://jsr.io/").replace(/\/?$/, "/");
}

/** A local checkout linked in deno.json "links" whose deno.json has this package name. */
export function linkedPackage(root: string, name: string): string | undefined {
  const deno = readJson<{ links?: string[] }>(path.join(root, "deno.json"));
  for (const link of deno.links ?? []) {
    const dir = path.resolve(root, link);
    const file = path.join(dir, "deno.json");
    if (existsSync(file) && readJson<{ name?: string }>(file).name === name) return dir;
  }
  return undefined;
}

/** The version deno.lock resolved for a jsr: dependency. */
export function lockedVersion(root: string, name: string): string | undefined {
  const lockFile = path.join(root, "deno.lock");
  if (!existsSync(lockFile)) return undefined;
  const specifiers = readJson<{ specifiers?: Record<string, string> }>(lockFile).specifiers ?? {};
  for (const [specifier, version] of Object.entries(specifiers)) {
    if (specifier.startsWith(`jsr:${name}@`)) return version;
  }
  return undefined;
}

/** Where a configured library comes from now, in the form stored in its stamp. */
export function librarySource(root: string, name: string): string {
  const link = linkedPackage(root, name);
  if (link) return `link:${link}`;
  const version = lockedVersion(root, name);
  if (!version) throw new Error(`Map library ${name} is not a dependency. Run: deno add jsr:${name}`);
  return `jsr:${version}`;
}

/** tsconfig "paths" for one library's exports: "<name>/<subpath>" -> "./.lib/<name>/<file>". */
export function exportPaths(name: string, exports: Record<string, string>): Record<string, string[]> {
  const paths: Record<string, string[]> = {};
  for (const [subpath, file] of Object.entries(exports)) {
    const key = subpath === "." ? name : `${name}/${subpath.replace(/^\.\//, "")}`;
    paths[key] = ["./" + posix.join(LIB_DIR, name, file.replace(/^\.\//, ""))];
  }
  return paths;
}

function isLibraryPath(targets: string[]): boolean {
  return targets.every(target => target.startsWith(`./${LIB_DIR}/`));
}

/** Replace every tsconfig path that points into .lib with `paths`. Returns true if tsconfig.json changed. */
export function writeLibraryPaths(root: string, paths: Record<string, string[]>): boolean {
  const file = path.join(root, "tsconfig.json");
  const text = Deno.readTextFileSync(file);
  const tsconfig = JSON.parse(text) as TsConfigPaths;
  const kept = Object.entries(tsconfig.compilerOptions.paths ?? {}).filter(([, targets]) => !isLibraryPath(targets));
  const next = Object.fromEntries([...kept, ...Object.entries(paths)]);
  if (JSON.stringify(next) === JSON.stringify(tsconfig.compilerOptions.paths ?? {})) return false;
  tsconfig.compilerOptions.paths = next;
  Deno.writeTextFileSync(file, JSON.stringify(tsconfig, null, 2) + "\n");
  return true;
}

function readStamp(root: string, name: string): Stamp | undefined {
  const file = path.join(root, LIB_DIR, name, STAMP);
  return existsSync(file) ? readJson<Stamp>(file) : undefined;
}

/** True when .lib and tsconfig paths match config.json "libraries" and deno.lock. Linked libraries always re-sync. */
export function librariesInSync(root: string, libraries: string[]): boolean {
  const expected: Record<string, string[]> = {};
  for (const name of libraries) {
    const source = librarySource(root, name);
    const stamp = readStamp(root, name);
    if (source.startsWith("link:") || !stamp || stamp.source !== source) return false;
    Object.assign(expected, exportPaths(name, stamp.exports));
  }
  const paths = readJson<TsConfigPaths>(path.join(root, "tsconfig.json")).compilerOptions.paths ?? {};
  const current = Object.fromEntries(Object.entries(paths).filter(([, targets]) => isLibraryPath(targets)));
  if (JSON.stringify(current) !== JSON.stringify(expected)) return false;
  // Nothing stale left over from a library that was removed from config.json.
  const libDir = path.join(root, LIB_DIR);
  const present = existsSync(libDir) ? listPackages(libDir) : [];
  return present.length === libraries.length && present.every(name => libraries.includes(name));
}

function listPackages(libDir: string): string[] {
  const names: string[] = [];
  for (const scope of Deno.readDirSync(libDir)) {
    if (!scope.isDirectory) continue;
    for (const pkg of Deno.readDirSync(path.join(libDir, scope.name))) if (pkg.isDirectory) names.push(`${scope.name}/${pkg.name}`);
  }
  return names;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return "sha256-" + Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
}

/** Download a published version's TypeScript files and verify them against the registry manifest. */
async function fromRegistry(name: string, version: string, target: string): Promise<Record<string, string>> {
  const base = `${registry()}${name}/${version}`;
  const response = await fetch(`${base}_meta.json`);
  if (!response.ok) throw new Error(`Could not read ${base}_meta.json (${response.status})`);
  const meta = await response.json() as { manifest: Record<string, { checksum: string }>; exports: Record<string, string> };
  for (const [file, entry] of Object.entries(meta.manifest)) {
    if (!file.endsWith(".ts")) continue;
    const download = await fetch(`${base}${file}`);
    if (!download.ok) throw new Error(`Could not download ${base}${file} (${download.status})`);
    const bytes = new Uint8Array(await download.arrayBuffer());
    if (await sha256(bytes) !== entry.checksum) throw new Error(`Checksum mismatch for ${name}@${version}${file}`);
    const dest = path.join(target, file);
    await Deno.mkdir(path.dirname(dest), { recursive: true });
    await Deno.writeFile(dest, bytes);
  }
  return meta.exports;
}

/** Copy a linked checkout's TypeScript files, leaving out what the package doesn't publish. */
function fromLink(dir: string, target: string): Record<string, string> {
  const deno = readJson<{ exports?: Record<string, string> | string; publish?: { exclude?: string[] } }>(path.join(dir, "deno.json"));
  const exports = typeof deno.exports === "string" ? { ".": deno.exports } : deno.exports ?? {};
  const excluded = (deno.publish?.exclude ?? []).map(entry => entry.replace(/^\.\//, "").replace(/\/$/, ""));
  const copy = (relative: string) => {
    for (const entry of Deno.readDirSync(path.join(dir, relative))) {
      const child = posix.join(relative, entry.name);
      if (entry.name.startsWith(".") || entry.name === "node_modules" || excluded.includes(child)) continue;
      if (entry.isDirectory) copy(child);
      else if (entry.isFile && entry.name.endsWith(".ts")) {
        Deno.mkdirSync(path.join(target, relative), { recursive: true });
        Deno.copyFileSync(path.join(dir, child), path.join(target, child));
      }
    }
  };
  copy("");
  return exports;
}

/** Copy every configured library into .lib and rewrite the library entries in tsconfig "paths". */
export async function syncLibraries(root: string, libraries: string[]): Promise<void> {
  const libDir = path.join(root, LIB_DIR);
  if (existsSync(libDir)) await Deno.remove(libDir, { recursive: true });
  const paths: Record<string, string[]> = {};
  for (const name of libraries) {
    const source = librarySource(root, name);
    const target = path.join(libDir, name);
    await Deno.mkdir(target, { recursive: true });
    const exports = source.startsWith("link:")
      ? fromLink(source.slice("link:".length), target)
      : await fromRegistry(name, source.slice("jsr:".length), target);
    const stamp: Stamp = { name, source, exports };
    await Deno.writeTextFile(path.join(target, STAMP), JSON.stringify(stamp, null, 2) + "\n");
    Object.assign(paths, exportPaths(name, exports));
    logger.info(`Synced map library ${name} (${source}) into ${path.relative(root, target)}`);
  }
  if (writeLibraryPaths(root, paths)) logger.info("Updated map library paths in tsconfig.json.");
}

/** Sync only if something changed: used by build, test and typecheck. No network when in sync. */
export async function ensureLibraries(root = Deno.cwd()): Promise<void> {
  const libraries = loadProjectConfig(root).libraries ?? [];
  if (!librariesInSync(root, libraries)) await syncLibraries(root, libraries);
}

if (import.meta.main) {
  try {
    if (Deno.args.includes("--if-needed")) await ensureLibraries();
    else await syncLibraries(Deno.cwd(), loadProjectConfig().libraries ?? []);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    Deno.exitCode = 1;
  }
}
