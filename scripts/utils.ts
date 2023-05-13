import { execSync } from "child_process";
import { writeFileSync } from "fs";
import * as fs from "fs-extra";
import * as path from "path";
import { createLogger, format, transports } from "winston";
const { combine, timestamp, printf } = format;
const luamin = require('luamin');

export interface IProjectConfig {
  mapFolder: string;
  minifyScript: boolean;
  gameExecutable: string;
  outputFolder: string;
  launchArgs: string[];
  winePath?: string;
  winePrefix?: string;
}

/**
 * Load an object from a JSON file.
 * @param fname The JSON file
 */
export function loadJsonFile(fname: string) {
  try {
    return JSON.parse(fs.readFileSync(fname).toString());
  } catch (e: any) {
    logger.error(e.toString());
    return {};
  }
}

/**
 * Convert a Buffer to ArrayBuffer
 * @param buf
 */
export function toArrayBuffer(b: Buffer): ArrayBuffer {
  var ab = new ArrayBuffer(b.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < b.length; ++i) {
    view[i] = b[i];
  }
  return ab;
}

/**
 * Convert a ArrayBuffer to Buffer
 * @param ab
 */
export function toBuffer(ab: ArrayBuffer) {
  var buf = Buffer.alloc(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }
  return buf;
}

/**
 * Recursively retrieve a list of files in a directory.
 * @param dir The path of the directory
 */
export function getFilesInDirectory(dir: string) {
  const files: string[] = [];
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      const d = getFilesInDirectory(fullPath);
      for (const n of d) {
        files.push(n);
      }
    } else {
      files.push(fullPath);
    }
  });
  return files;
};

function updateTSConfig(mapFolder: string) {
  const tsconfig = loadJsonFile('tsconfig.json');
  const plugin = tsconfig.compilerOptions.plugins[0];

  plugin.mapDir = path.resolve('maps', mapFolder).replace(/\\/g, '/');
  plugin.entryFile = path.resolve(tsconfig.tstl.luaBundleEntry).replace(/\\/g, '/');
  plugin.outputDir = path.resolve('dist', mapFolder).replace(/\\/g, '/');

  writeFileSync('tsconfig.json', JSON.stringify(tsconfig, undefined, 2));
}

/**
 *
 */
export function compileMap(config: IProjectConfig) {
  if (!config.mapFolder) {
    logger.error(`Could not find key "mapFolder" in config.json`);
    return false;
  }

  const tsLua = "./dist/tstl_output.lua";

  if (fs.existsSync(tsLua)) {
    fs.unlinkSync(tsLua);
  }

  logger.info(`Building "${config.mapFolder}"...`);
  fs.copySync(`./maps/${config.mapFolder}`, `./dist/${config.mapFolder}`);

  logger.info("Modifying tsconfig.json to work with war3-transformer...");
  updateTSConfig(config.mapFolder);

  logger.info("Transpiling TypeScript to Lua...");
  execSync('tstl -p tsconfig.json', { stdio: 'inherit' });

  if (!fs.existsSync(tsLua)) {
    logger.error(`Could not find "${tsLua}"`);
    return false;
  }

  // Merge the TSTL output with war3map.lua
  const mapLua = `./dist/${config.mapFolder}/war3map.lua`;

  if (!fs.existsSync(mapLua)) {
    logger.error(`Could not find "${mapLua}"`);
    return false;
  }

  try {
    let contents = fs.readFileSync(mapLua).toString() + fs.readFileSync(tsLua).toString();

    if (config.minifyScript) {
      logger.info(`Minifying script...`);
      contents = luamin.minify(contents.toString());
    }

    fs.writeFileSync(mapLua, contents);
  } catch (err: any) {
    logger.error(err.toString());
    return false;
  }

  return true;
}

/**
 * Formatter for log messages.
 */
const loggerFormatFunc = printf(({ level, message, timestamp }) => {
  return `[${timestamp.replace("T", " ").split(".")[0]}] ${level}: ${message}`;
});

/**
 * The logger object.
 */
export const logger = createLogger({
  transports: [
    new transports.Console({
      format: combine(
        format.colorize(),
        timestamp(),
        loggerFormatFunc
      ),
    }),
    new transports.File({
      filename: "project.log",
      format: combine(
        timestamp(),
        loggerFormatFunc
      ),
    }),
  ]
});
