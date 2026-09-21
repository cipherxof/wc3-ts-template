import War3TSTLHelper from "war3tstlhelper";
import { logger } from "../shared/utils.ts";
import { loadProjectConfig } from "../shared/config.ts";

const config = loadProjectConfig();

// Create definitions file for generated globals
const luaFile = `./maps/${config.mapFolder}/war3map.lua`;

try {
    const contents = Deno.readTextFileSync(luaFile);
    const parser = new War3TSTLHelper(contents);
    const result = parser.genTSDefinitions();
    Deno.writeTextFileSync("src/war3map.d.ts", result);
} catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    logger.error(`There was an error generating the definition file for '${luaFile}'`);
    Deno.exitCode = 1;
}
