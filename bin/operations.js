const fs = require("fs-extra");
const War3TSTLHelper = require("war3tstlhelper");
const execFile = require("child_process").execFile;
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
    const tsLua = "./dist/tstl_output.lua";

    if (!fs.existsSync(tsLua)) {
      return console.error(`Could not find "${tsLua}"`);
    }

    console.log(`Building "${config.mapFolder}"...`);
    fs.copy(`./maps/${config.mapFolder}`, `./dist/${config.mapFolder}`, function (err) {
      if (err) {
        return console.error(err);
      }

      // Merge the TSTL output with war3map.lua
      const mapLua = `./dist/${config.mapFolder}/war3map.lua`;

      if (!fs.existsSync(mapLua)) {
        return console.error(`Could not find "${mapLua}"`);
      }

      try {
        const tsLuaContents = fs.readFileSync(tsLua);
        fs.appendFileSync(mapLua, tsLuaContents);
      } catch (err) {
        return console.error(err);
      }

      console.log(`Completed!`);
    });

    break;

  case "run":
    const filename = `${cwd}/dist/${config.mapFolder}`;

    console.log(`Running ${filename}...`);

    execFile(config.gameExecutable, ["-loadfile", filename, ...config.launchArgs], (err, stdout, stderr) => {
      if (err) {
        if (err.code === 'ENOENT') {
          return console.error(`No such file or directory "${config.gameExecutable}". Make sure gameExecutable is configured properly in config.json.`);
        }
        return console.error(err);
      }
    });

    break;
  case "gen-defs":
    // Create definitions file for generated globals
    const luaFile = `./maps/${config.mapFolder}/war3map.lua`;

    try {
      const contents = fs.readFileSync(luaFile, "utf8");
      const parser = new War3TSTLHelper(contents);
      const result = parser.genTSDefinitions();
      fs.writeFileSync("src/war3map.d.ts", result);
    } catch (err) {
      console.log(err);
      console.log(`There was an error generating the definition file for '${luaFile}'`);
      return;
    }

    break;
}
