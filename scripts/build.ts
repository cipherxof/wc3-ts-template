import * as path from "@std/path";
import { War3Map } from "./warcraft-library.ts";
import { getFilesInDirectory, logger, toArrayBuffer, runCli } from "./utils.ts";
import { loadProjectConfig } from "./config.ts";
import { compileMap } from "./compile.ts";

function main() {
  const config = loadProjectConfig();
  const minify = Deno.args.includes("-minify") || config.minifyScript;

  if (minify !== config.minifyScript) {
    logger.info('Enabling minification from command line argument "-minify".');
    config.minifyScript = minify;
  }
  const mapDir = compileMap(config);

  logger.info(`Creating w3x archive...`);
  Deno.mkdirSync(config.outputFolder, { recursive: true });
  createMapFromDir(path.join(config.outputFolder, config.mapFolder), mapDir);
}

/**
 * Creates a w3x archive from a directory
 * @param output The output filename
 * @param dir The directory to create the archive from
 */
export function createMapFromDir(output: string, dir: string) {
  const map = new War3Map();
  const files = getFilesInDirectory(dir);

  map.archive.resizeHashtable(files.length);

  for (const fileName of files) {
    const contents = toArrayBuffer(Deno.readFileSync(fileName));
    const archivePath = path.relative(dir, fileName).replace(/\\/g, "/");
    const imported = map.import(archivePath, contents);

    if (!imported) {
      throw new Error("Failed to import " + archivePath);
    }
  }

  const result = saveMapArchive(map);

  if (!result) {
    throw new Error("Failed to save archive.");
  }

  Deno.writeFileSync(output, new Uint8Array(result));

  logger.info("Finished!");
}


// TODO: Look at
/** Preserve modern metadata that the pinned library cannot fully parse. */
function saveMapArchive(map: InstanceType<typeof War3Map>): ArrayBuffer | Uint8Array | null {
  const info = map.get("war3map.w3i")?.arrayBuffer();
  if (info && info.byteLength >= 28) {
    const header = new DataView(info);
    const version = header.getInt32(0, true);
    const buildVersion = header.getUint32(12, true) * 100 + header.getUint32(16, true);
    // War3Map.save() parses the entire w3i just to choose the legacy HM3W
    // header. Version 39 retains the build-version prefix but adds fields
    // unsupported by that parser. Match its headerless path for 1.31+ maps.
    if (version === 39 && buildVersion >= 131) {
      map.setImportsFile();
      return map.archive.save();
    }
  }
  return map.save();
}

if (import.meta.main) runCli(main);
