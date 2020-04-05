import * as fs from "fs-extra";
import { FILE_EXISTS } from "mdx-m3-viewer/src/parsers/mpq/constants";
import War3Map from "mdx-m3-viewer/src/parsers/w3x/map";
import * as path from "path";
import { compileMap, getFilesInDirectory, loadJsonFile, logger, toArrayBuffer } from "./utils";

function main() {
  const config = loadJsonFile("config.json");
  const result = compileMap(config);

  if (!result) {
    logger.error(`Failed to compile map.`);
    return;
  }

  logger.info(`Creating w3x archive...`);
  if (!fs.existsSync(config.outputFolder)) {
    fs.mkdirSync(config.outputFolder);
  }

  createMapFromDir(`${config.outputFolder}/${config.mapFolder}`, `./dist/${config.mapFolder}`);
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
    const contents = toArrayBuffer(fs.readFileSync(fileName));
    const archivePath = path.relative(dir, fileName);
    const imported = map.import(archivePath, contents);

    if (!imported) {
      logger.warn("Failed to import " + archivePath);
      continue;
    }

    if (fileName.toLowerCase().indexOf(".blp") !== -1 || fileName.toLowerCase().indexOf(".mp3") !== -1) {
      const file = map.archive.files.find((e) => e.name === archivePath);
      if (file) {
        file.rawBuffer = contents;
        file.block.compressedSize = contents.byteLength;
        file.block.flags = FILE_EXISTS;
      }
    }
  }

  const result = map.save();

  if (!result) {
    logger.error("Failed to save archive.");
    return;
  }

  fs.writeFileSync(output, new Uint8Array(result));

  logger.info("Finished!");
}

main();