var fs = require('fs');
var War3TSTLHelper = require('war3tstlhelper');

// Create definitions file for generated globals
const luaFile = 'maps/map.w3x/war3map.lua';

try{
    const contents = fs.readFileSync(luaFile, 'utf8');
    const parser = new War3TSTLHelper(contents);
    const result = parser.genTSDefinitions();
    fs.writeFileSync('src-ts/types/war3map.d.ts', result);
} catch(err) {
    console.log(err);
    console.log(`There was an error creating the definition file for '${luaFile}'`);
    return;
}