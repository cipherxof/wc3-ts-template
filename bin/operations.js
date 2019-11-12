const fs = require("fs");
const War3TSTLHelper = require("war3tstlhelper");
const execFile = require("child_process").execFile;
const cwd = process.cwd();
const exec = require('child_process').exec;

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
    execFile("./bin/ceres", ["build", config.mapFolder], function (err, data) {
      if (data.length > 0) console.log(data);
      if (err != null) return console.error("There was an error launching ceres.");

      // remove ceres.toml, we don't need multiple config files for the same thing
      fs.unlinkSync("ceres.toml");
    });


    break;

  case "run":
    const filename = `${cwd}/target/${config.mapFolder}`;

    execFile(config.gameExecutable, ["-loadfile", filename, ...config.launchArgs]);

    break;
  case "gen-defs":
    // Create definitions file for generated globals
    const luaFile = `${cwd}/maps/${config.mapFolder}/war3map.lua`;

    console.log(luaFile);

    try {
      const contents = fs.readFileSync(luaFile, "utf8");
      const parser = new War3TSTLHelper(contents);
      const result = parser.genTSDefinitions();
      fs.writeFileSync("src-ts/war3map.d.ts", result);
    } catch (err) {
      console.log(err);
      console.log(`There was an error generating the definition file for '${luaFile}'`);
      return;
    }

    break;
}
