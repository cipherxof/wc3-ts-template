const fs = require("fs");
const War3TSTLHelper = require("war3tstlhelper");
const exec = require("child_process").execFile;
const cwd = process.cwd();

// Parse configuration
let config = {};
try {
  config = JSON.parse(fs.readFileSync("config.json"));
} catch (e) {
  return console.error(e);
}

// Handle the operation
const operation = process.argv[2];

switch (operation) {
  case "build":
    // create temporary ceres.toml to prevent ceres from throwing an error
    fs.writeFileSync("ceres.toml", '[run]\nwc3_start_command=""');

    // build war3map.lua with ceres
    exec("bin\\ceres.exe", ["build", "map.w3x"], function(err, data) {
      console.log(data);

      if (err != null) {
        console.log("There was an error launching ceres.");
      }

      // remove ceres.toml, we don't need multiple config files for the same thing
      fs.unlinkSync("ceres.toml");
    });

    break;

  case "run":
    const filename = `${cwd}\\${process.argv[3]}`;

    exec(config.gameExecutable, config.launchArgs.concat(["-loadfile", filename]), function(err, data) {
      if (err != null) {
        console.log(`Error: ${err.code}`);
        console.log('There was an error launching the game. Make sure the path to your game executable has been set correctly in "config.js".');
        console.log(`Current Path: "${config.gameExecutable}"`);
      }
    });

    break;
  case "gen-defs":
    // Create definitions file for generated globals
    const luaFile = "maps/map.w3x/war3map.lua";

    try {
      const contents = fs.readFileSync(luaFile, "utf8");
      const parser = new War3TSTLHelper(contents);
      const result = parser.genTSDefinitions();
      fs.writeFileSync("src-ts/types/war3map.d.ts", result);
    } catch (err) {
      console.log(err);
      console.log(`There was an error generating the definition file for '${luaFile}'`);
      return;
    }

    break;
}
