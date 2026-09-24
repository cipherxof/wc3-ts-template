import { execFile } from "node:child_process";
import { loadProjectConfig } from "./shared/config.ts";
import { compileMap, entryArgument } from "./compile.ts";
import { logger, runCli } from "./shared/utils.ts";

function main(): void {
  const config = loadProjectConfig();
  const entry = entryArgument(Deno.args);
  if (entry) logger.info(`Building with entry point ${entry}.`);
  const filename = compileMap(config, undefined, entry);
  const executable = config.winePath || config.gameExecutable;
  const mapPath = config.winePath ? `Z:${filename.replace(/\//g, "\\")}` : filename;
  const args = [...(config.winePath ? [config.gameExecutable] : []), "-loadfile", mapPath, ...config.launchArgs];
  const env = { ...Deno.env.toObject(), ...(config.winePrefix ? { WINEPREFIX: config.winePrefix } : {}) };
  logger.info(`Launching map '${filename}'...`);
  // Deno defaults windowsHide to true; Warcraft III needs a visible GUI window.
  execFile(executable, args, { env, windowsHide: false }, error => {
    if (error) {
      logger.error(`Could not launch Warcraft III: ${error.message}`);
      Deno.exitCode = 1;
    }
  });
}

if (import.meta.main) runCli(main);
