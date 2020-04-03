import * as fs from "fs-extra";
import { loadJsonFile, logger } from "./utils";
const War3TSTLHelper = require("war3tstlhelper");

const config = loadJsonFile("config.json");

// Create definitions file for generated globals
const luaFile = `./maps/${config.mapFolder}/war3map.lua`;

try {
    const contents = fs.readFileSync(luaFile, "utf8");
    const parser = new War3TSTLHelper(contents);
    const result = parser.genTSDefinitions();
    fs.writeFileSync("src/war3map.d.ts", result);
} catch (err) {
    logger.error(err.toString());
    logger.error(`There was an error generating the definition file for '${luaFile}'`);
}