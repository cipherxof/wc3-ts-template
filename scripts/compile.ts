import { removeIfExists, writeJsonFile, loadJsonFile } from "./files.ts";
import { existsSync, copySync } from "@std/fs";
import * as path from "@std/path";
import { fromFileUrl } from "@std/path";
import luamin from "luamin";
import { IProjectConfig } from "./config.ts";
import { injectObjectData } from "./object-files.ts";
import { logger, runCommand } from "./utils.ts";
import { evaluateObjects } from "./evaluate-objects.ts";
import { applyAssetPlan, assetLocations, evaluateAssetConfig, planAssets } from "./assets.ts";

interface TsConfig {
  compilerOptions: {
    plugins: Array<{
      transform: string;
      mapDir?: string;
      entryFile?: string;
      outputDir?: string;
    }>;
  };
  tstl: {
    luaBundle: string;
    luaBundleEntry: string;
  };
}

/** Use isolated config to preserve relative paths. */
export function createBuildConfig(config: IProjectConfig): string {
  const tsconfig = loadJsonFile<TsConfig>("tsconfig.json");
  const plugin = tsconfig.compilerOptions.plugins.find((entry: { transform: string }) => entry.transform === "war3-transformer");
  if (!plugin) throw new Error("tsconfig.json is missing war3-transformer.");
  plugin.mapDir = path.resolve("maps", config.mapFolder);
  plugin.entryFile = path.resolve(tsconfig.tstl.luaBundleEntry);
  plugin.outputDir = path.resolve("dist", config.mapFolder);
  const filename = path.resolve(`tsconfig.build.${Deno.pid}.json`);
  writeJsonFile(filename, tsconfig, { spaces: 2 });
  return filename;
}

/** Reject packed maps and incomplete exports before generating any output. */
export function validateBaseMap(sourcePath: string): void {
  for (const filename of ["war3map.lua", "war3map.w3i"]) {
    const file = path.join(sourcePath, filename);
    if (!existsSync(file) || !Deno.statSync(file).isFile) {
      throw new Error(`Missing ${file}. Use an unpacked .w3x directory saved by the World Editor with Lua as its scripting language. See docs/custom-maps.md.`);
    }
  }
}

export function compileMap(config: IProjectConfig): string {
  // VALIDATE BASE MAP
  const sourcePath = path.resolve("maps", config.mapFolder);
  const destPath = path.resolve("dist", config.mapFolder);
  validateBaseMap(sourcePath);
  const assetConfig = evaluateAssetConfig();
  const { stateFile } = assetLocations(Deno.cwd(), config.mapFolder);
  // Preflight before generation/staging; source map ownership is never changed by a build.
  planAssets(Deno.cwd(), sourcePath, stateFile, assetConfig);

  // EVALUATE PKL OBJECTS
  logger.info("Evaluating Pkl object data...");
  evaluateObjects();

  // STAGE MAP DIRECTORY
  const dist = path.resolve("dist");
  if (path.dirname(destPath) !== dist || destPath === dist) throw new Error("Map staging path must be a direct child of dist.");
  removeIfExists(destPath);
  copySync(sourcePath, destPath);
  applyAssetPlan(planAssets(Deno.cwd(), destPath, stateFile, assetConfig));
  const bundle = path.resolve(loadJsonFile<TsConfig>("tsconfig.json").tstl.luaBundle);
  if (!bundle.startsWith(dist + path.SEPARATOR)) throw new Error("Lua bundle must be inside dist.");
  removeIfExists(bundle);

  // TRANSPILE TYPESCRIPT TO LUA
  const buildConfig = createBuildConfig(config);
  try {
    logger.info("Transpiling TypeScript to Lua...");
    const tstlPath = fromFileUrl(import.meta.resolve("typescript-to-lua/dist/tstl.js"));
    runCommand(Deno.execPath(), ["run", "-A", tstlPath, "-p", buildConfig]);
  } finally {
    removeIfExists(buildConfig);
  }

  // INJECT OBJECT DATA
  logger.info("Applying Pkl object data...");
  injectObjectData(destPath, loadJsonFile("src/generated/objects.json"));

  // MERGE LUA SCRIPTS
  const mapLua = path.join(destPath, "war3map.lua");
  let contents = Deno.readTextFileSync(mapLua) + "\n" + Deno.readTextFileSync(bundle);
  if (config.minifyScript) contents = luamin.minify(contents);
  Deno.writeTextFileSync(mapLua, contents);
  return destPath;
}
