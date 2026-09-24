import { removeIfExists, writeJsonFile, loadJsonFile } from "../shared/files.ts";
import assert from "node:assert/strict";
const test = Deno.test;
import * as path from "@std/path";
import { ObjectData } from "war3-objectdata-th";
import { SimpleFile, LevelFile, War3Map } from "../shared/warcraft-library.ts";
import { createMapFromDir } from "../build.ts";
import { getFilesInDirectory, runCommand, toArrayBuffer } from "../shared/utils.ts";
import { copySync } from "@std/fs";
import MapInfoModule from "mdx-m3-viewer-th/dist/cjs/parsers/w3x/w3i/file.js";
import { applyObjectData } from "../objects/data.ts";
import { injectObjectData } from "../objects/files.ts";
import { loadProjectConfig } from "../shared/config.ts";
import { createBuildConfig, validateBaseMap } from "../compile.ts";
import { plugin as wcraftLintPlugin } from "../lint/wcraft-rules.ts";
import { validateJsonSyntax, validateProjectJsonFiles } from "../tooling/validate-json.ts";
import "./assets.ts";
import "./map-settings.ts";
import "./library.ts";

test("unit aliases, null inheritance, lists and explicit property overrides", () => {
  const data = new ObjectData();
  const originalName = data.units.get("hfoo")!.name;
  applyObjectData(data, { units: { u001: {
    base: "hfoo", name: null, goldCost: 99, abilities: [], movementType: "foot",
    properties: { goldCost: 0, lumberCost: null },
  } } });
  const unit = data.units.get("u001")!;
  assert.equal(unit.name, originalName);
  assert.equal(unit.goldCostundefined, 0);
  assert.equal(unit.normal, "");
  assert.equal(unit.type, "foot");
  assert.equal(unit.lumberCostundefined, data.units.get("hfoo")!.lumberCostundefined);
});

test("items use item field names and preserve false values", () => {
  const data = new ObjectData();
  applyObjectData(data, { items: { sword: {
    id: "I001", base: "ratf", goldCost: 0, perishable: false,
    tintingColorRed: 80, abilities: ["AInv"],
  } } });
  const item = data.items.get("I001")!;
  assert.equal(item.goldCost, 0);
  assert.equal(item.perishable, false);
  assert.equal(item.tintingColor1Red, 80);
  assert.equal(item.abilities, "AInv");
});

test("all seven categories survive binary serialization and reloading", () => {
  const data = new ObjectData();
  applyObjectData(data, {
    heroes: { H001: { base: "Hpal", name: "Test hero" } },
    units: { u001: { base: "hfoo", name: "Test unit" } },
    buildings: { b001: { base: "hbar", name: "Test building" } },
    items: { I001: { base: "ratf", name: "Test item" } },
    abilities: { A001: { base: "AHhb", name: "Test ability" } },
    buffs: { B001: { base: "BHbz", name: "Test buff" } },
    upgrades: { R001: { base: "Rhme", name: "Test upgrade", upgradeClass: "armor" } },
  });
  const saved = data.save();
  const restored = new ObjectData();
  const parsed = Object.fromEntries(Object.entries(saved).map(([key, file]) => {
    const parser = /w3[daq]/.test(key) ? new LevelFile() : new SimpleFile();
    parser.load(file.save());
    return [key, parser];
  }));
  restored.load(parsed);
  for (const [container, id, name] of [
    [restored.units, "H001", "Test hero"], [restored.units, "u001", "Test unit"],
    [restored.units, "b001", "Test building"], [restored.items, "I001", "Test item"],
    [restored.abilities, "A001", "Test ability"],
    [restored.upgrades, "R001", "Test upgrade"],
  ] as const) assert.equal(container.get(id)!.name, name);
  assert.equal(restored.buffs.get("B001")!.nameEditorOnly, "Test buff");
  assert.equal(restored.upgrades.get("R001")!.class, "armor");
});

test("invalid manifests fail before creating custom objects", () => {
  for (const invalid of [
    { buildings: { u001: { base: "hbar" } } },
    { items: { I001: { base: "xxxx" } } },
    { items: { I001: { base: "ratf", goldCots: 1 } } },
    { items: { I001: { base: "ratf", properties: { newId: "I002" } } } },
    { abilities: { A001: { base: "AHhb", cooldown: [1, 2, 3] } } },
    { items: { "bad!": { base: "ratf" } } },
    { items: [] }, { typo: {} },
  ]) {
    const data = new ObjectData();
    assert.throws(() => applyObjectData(data, { units: { u001: { base: "hfoo", name: "Valid" } }, ...invalid }));
    assert.equal(data.units.has("u001"), false);
  }
});

test("existing game and map IDs cannot be silently overwritten", () => {
  const data = new ObjectData();
  assert.throws(() => applyObjectData(data, { units: { hfoo: { base: "hbar" } } }), /already exists/);
  data.units.copy("hfoo", "u001");
  assert.throws(() => applyObjectData(data, { units: { u001: { base: "hbar" } } }), /already exists/);
});

test("file injection writes buffs/upgrades and preserves existing modifications", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts-object-tests-" });
  try {
    injectObjectData(dir, { buffs: { B001: { base: "BHbz", name: "Existing" } } });
    injectObjectData(dir, { upgrades: { R001: { base: "Rhme", name: "New upgrade", goldBase: 42 } } });
    const buff = new SimpleFile();
    buff.load(Deno.readFileSync(path.join(dir, "war3mapSkin.w3h")));
    assert.equal(buff.customTable.objects[0].newId, "B001");
    const upgrade = new LevelFile();
    upgrade.load(Deno.readFileSync(path.join(dir, "war3map.w3q")));
    assert.equal(upgrade.customTable.objects[0].newId, "R001");
    assert(upgrade.customTable.objects[0].modifications.some(mod => mod.id === "gglb" && mod.value === 42));
  } finally {
    removeIfExists(dir);
  }
});

test("config overrides are validated and malformed JSON fails clearly", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts-config-tests-" });
  const config = { mapFolder: "map.w3x", minifyScript: false, gameExecutable: "game.exe", outputFolder: "dist/bin", launchArgs: [] };
  try {
    writeJsonFile(path.join(dir, "config.json"), config);
    writeJsonFile(path.join(dir, "config.local.json"), { gameExecutable: "Local Game.exe", launchArgs: ["-windowed"] });
    assert.deepEqual(loadProjectConfig(dir), { ...config, gameExecutable: "Local Game.exe", launchArgs: ["-windowed"] });
    writeJsonFile(path.join(dir, "config.local.json"), { mapFolder: "../map.w3x" });
    assert.throws(() => loadProjectConfig(dir), /mapFolder/);
    Deno.writeTextFileSync(path.join(dir, "config.local.json"), "{");
    assert.throws(() => loadProjectConfig(dir), /Cannot read.*config.local.json/);
  } finally {
    removeIfExists(dir);
  }
});

test("base map validation rejects archives and incomplete directory exports", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts-map-validation-" });
  try {
    const packed = path.join(dir, "packed.w3x");
    Deno.writeTextFileSync(packed, "archive");
    assert.throws(() => validateBaseMap(packed), /unpacked/);
    assert.throws(() => validateBaseMap(dir), /war3map.lua/);
    Deno.writeTextFileSync(path.join(dir, "war3map.lua"), "-- Lua");
    assert.throws(() => validateBaseMap(dir), /war3map.w3i/);
    Deno.mkdirSync(path.join(dir, "war3map.w3i"));
    assert.throws(() => validateBaseMap(dir), /war3map.w3i/);
    Deno.removeSync(path.join(dir, "war3map.w3i"));
    Deno.writeFileSync(path.join(dir, "war3map.w3i"), new Uint8Array());
    assert.doesNotThrow(() => validateBaseMap(dir));
  } finally {
    removeIfExists(dir);
  }
});

test("build config does not modify tracked tsconfig", () => {
  const before = Deno.readTextFileSync("tsconfig.json");
  const filename = createBuildConfig(loadProjectConfig());
  try {
    assert.equal(Deno.readTextFileSync("tsconfig.json"), before);
    const generated = loadJsonFile<{ compilerOptions: { plugins: Array<{ mapDir: string }> } }>(filename);
    assert(path.isAbsolute(generated.compilerOptions.plugins[0].mapDir));
  } finally {
    removeIfExists(filename);
  }
});

test("custom lint plugin wcraft-rules catches invalid FourCC rawcodes", () => {
  const runLint = (code: string) => {
    const denoLint = (Deno as unknown as {
      lint?: {
        runPlugin: (plugin: unknown, filename: string, source: string) => Array<{ message: string; id: string }>;
      };
    }).lint;
    assert(denoLint, "Deno.lint is required for lint plugin tests");
    return denoLint.runPlugin(wcraftLintPlugin, "src/test.ts", code);
  };

  // Valid rawcodes
  assert.equal(runLint('FourCC("hfoo");').length, 0);
  assert.equal(runLint('FourCC("A000");').length, 0);
  assert.equal(runLint('FourCC(Units.Footman);').length, 0);

  // Invalid length (> 4)
  const tooLong = runLint('FourCC("hfoo1");');
  assert.equal(tooLong.length, 1);
  assert.match(tooLong[0].message, /must be exactly 4 characters/);

  // Invalid length (< 4)
  const tooShort = runLint('FourCC("hfo");');
  assert.equal(tooShort.length, 1);
  assert.match(tooShort[0].message, /must be exactly 4 characters/);

  // Invalid non-printable ASCII
  const nonAscii = runLint('FourCC("hf\\x00o");');
  assert.equal(nonAscii.length, 1);
  assert.match(nonAscii[0].message, /printable ASCII/);
});

test("validateJsonSyntax detects valid and corrupted JSON files", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts-json-tests-" });
  try {
    const validFile = path.join(dir, "valid.json");
    const invalidFile = path.join(dir, "invalid.json");
    writeJsonFile(validFile, { key: "value" });
    Deno.writeTextFileSync(invalidFile, "{ not valid json ");

    assert.equal(validateJsonSyntax(validFile).valid, true);
    const invalidResult = validateJsonSyntax(invalidFile);
    assert.equal(invalidResult.valid, false);
    assert(invalidResult.error);

    const projectResults = validateProjectJsonFiles();
    assert(projectResults.length >= 4);
    assert(projectResults.every(r => r.valid));
  } finally {
    removeIfExists(dir);
  }
});

test("Deno file staging and MPQ packaging preserve nested binary data", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts archive tests " });
  try {
    const source = path.join(dir, "source");
    const staged = path.join(dir, "staged");
    Deno.mkdirSync(path.join(source, "assets"), { recursive: true });
    const bytes = new Uint8Array([0, 255, 128, 13, 10, 0]);
    Deno.writeFileSync(path.join(source, "assets", "binary.dat"), bytes);
    Deno.writeTextFileSync(path.join(source, "war3map.lua"), "-- map script\n");
    const info = new MapInfoModule.default();
    info.version = 31;
    Deno.writeFileSync(path.join(source, "war3map.w3i"), new Uint8Array(info.save()));
    copySync(source, staged);
    assert.deepEqual(getFilesInDirectory(staged).map(file => path.relative(staged, file)), [
      path.join("assets", "binary.dat"), "war3map.lua", "war3map.w3i",
    ]);
    const archive = path.join(dir, "test.w3x");
    createMapFromDir(archive, staged);
    const map = new War3Map();
    map.load(Deno.readFileSync(archive));
    assert.deepEqual(new Uint8Array(map.get("assets\\binary.dat")!.arrayBuffer()!), bytes);
    assert.deepEqual(new Uint8Array(toArrayBuffer(bytes.subarray(1, 3))), new Uint8Array([255, 128]));
    removeIfExists(staged);
    removeIfExists(staged);
    assert.throws(() => Deno.statSync(staged), Deno.errors.NotFound);
  } finally {
    removeIfExists(dir);
  }
});

test("checked-in base map packages without changing its metadata or assets", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts-base-map-tests-" });
  try {
    const source = path.resolve("maps", loadProjectConfig().mapFolder);
    const archive = path.join(dir, "base.w3x");
    createMapFromDir(archive, source);
    const map = new War3Map();
    map.load(Deno.readFileSync(archive));
    for (const filename of getFilesInDirectory(source)) {
      const relative = path.relative(source, filename).replace(/\//g, "\\");
      assert.deepEqual(new Uint8Array(map.get(relative)!.arrayBuffer()!), Deno.readFileSync(filename), relative);
    }
    assert(!map.getImportNames().includes("war3map.w3i"));
  } finally {
    removeIfExists(dir);
  }
});

test("CLI failures persist timestamped logs and return a failing exit code", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts-log-tests-" });
  try {
    const moduleUrl = new URL("../shared/utils.ts", import.meta.url).href;
    const script = path.join(dir, "cli.ts");
    Deno.writeTextFileSync(script, `import { logger, runCli } from ${JSON.stringify(moduleUrl)};
logger.info("starting");
runCli(() => { throw new Error("intentional failure"); });`);
    const configPath = path.resolve("deno.json");
    const result = new Deno.Command(Deno.execPath(), {
      args: ["run", "--config", configPath, "-A", script], cwd: dir,
      stdout: "piped", stderr: "piped",
    }).outputSync();
    assert.equal(result.code, 1);
    const log = Deno.readTextFileSync(path.join(dir, "project.log"));
    assert.match(log, /\[\d{4}-.*Z\] info: starting\n/);
    assert.match(log, /error: intentional failure\n$/);
    assert.match(new TextDecoder().decode(result.stderr), /intentional failure/);
  } finally {
    removeIfExists(dir);
  }
});

test("Deno build commands preserve arguments and reject unsuccessful exits", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts command tests " });
  try {
    const script = path.join(dir, "child script.ts");
    const output = path.join(dir, "arguments.json");
    Deno.writeTextFileSync(script, 'Deno.writeTextFileSync(Deno.args[0], JSON.stringify(Deno.args.slice(1)));');
    const args = ["space in argument", 'a"quote', "Z:\\map folder\\map.w3x", "&literal"];
    runCommand(Deno.execPath(), ["run", "--no-config", "-A", script, output, ...args]);
    assert.deepEqual(loadJsonFile(output), args);
    Deno.writeTextFileSync(script, "Deno.exit(7);");
    assert.throws(() => runCommand(Deno.execPath(), ["run", "--no-config", script]), /exit code 7/);
    assert.throws(() => runCommand(path.join(dir, "missing-executable"), []), Deno.errors.NotFound);
  } finally {
    removeIfExists(dir);
  }
});
