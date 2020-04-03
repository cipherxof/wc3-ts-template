import * as fs from "fs-extra";
import { execFile } from "child_process";
import { loadJsonFile, logger, compileMap } from "./utils";

function main() {
  const config = loadJsonFile("config.json");
  const result = compileMap(config);

  if (!result) {
    logger.error(`Failed to compile map.`);
    return;
  }

  const cwd = process.cwd();
  const filename = `${cwd}/dist/${config.mapFolder}`;

  logger.info(`Launching map "${filename.replace(/\\/g, "/")}"...`);

  execFile(config.gameExecutable, ["-loadfile", filename, ...config.launchArgs], (err: any) => {
    if (err && err.code === 'ENOENT') {
      logger.error(`No such file or directory "${config.gameExecutable}". Make sure gameExecutable is configured properly in config.json.`);
    }
  });
}

main();