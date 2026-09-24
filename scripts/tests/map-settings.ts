import assert from "node:assert/strict";
import * as path from "@std/path";
import MapInfoModule from "mdx-m3-viewer-th/dist/cjs/parsers/w3x/w3i/file.js";
import { patchMapInfo, patchSettingsText, planMapSettings, validateMapSettings, evaluateMapSettings } from "../map-settings/settings.ts";
import { createMapFromDir } from "../build.ts";
import { War3Map } from "../shared/warcraft-library.ts";
import { toArrayBuffer } from "../shared/utils.ts";
import { readMapInfo } from "../map-settings/map-info.ts";
import { luaString } from "../map-settings/lua.ts";
import { loadProjectConfig } from "../shared/config.ts";

const fixture = new URL("./fixtures/map-settings-v39/", import.meta.url);

Deno.test("map metadata patches round-trip across supported w3i versions and preserve the tail", () => {
  for (const version of [18, 25, 28, 31, 32, 33]) {
    const info = new MapInfoModule.default();
    info.version = version;
    info.name = "TRIGSTR_001";
    info.author = "Original";
    info.description = "Keep me";
    info.loadingScreenText = "Old loading text";
    const original = new Uint8Array(info.save());
    const settings = validateMapSettings({ info: { name: "雪 ⚔", author: "", description: null }, loadingScreen: { title: "Ready", background: -1 } });
    const patched = patchMapInfo(original, settings);
    const restored = new MapInfoModule.default();
    restored.load(toArrayBuffer(patched));
    assert.equal(restored.name, "雪 ⚔");
    assert.equal(restored.author, "");
    assert.equal(restored.description, "Keep me");
    assert.equal(restored.loadingScreenText, "Old loading text");
    assert.equal(restored.loadingScreenTitle, "Ready");
    assert.equal(restored.campaignBackground, -1);
    // Undo just these fields: every byte, including untouched binary data, must match.
    assert.deepEqual(patchMapInfo(patched, validateMapSettings({ info: { name: info.name, author: info.author }, loadingScreen: { title: "", background: 0 } })), original);
    assert.deepEqual(patchMapInfo(patched, settings), patched);
  }
});

Deno.test("real Reforged map preserves unknown data and WTS references", () => {
  const original = Deno.readFileSync(path.resolve("maps", loadProjectConfig().mapFolder, "war3map.w3i"));
  const start = new DataView(original.buffer).getInt32(0, true) > 27 ? 28 : 12;
  const end = original.indexOf(0, start);
  const patched = patchMapInfo(original, validateMapSettings({ info: { name: "A new name" } }));
  assert.deepEqual(patched.subarray(0, start), original.subarray(0, start));
  assert.deepEqual(patched.subarray(start + new TextEncoder().encode("A new name\0").length), original.subarray(end + 1));
  assert.strictEqual(patchMapInfo(original, validateMapSettings({})), original);
});

Deno.test("map settings fail clearly on invalid fields, text injection, versions and truncation", () => {
  for (const value of [null, [], { typo: {} }, { info: { typo: null } }, { info: { name: "bad\0text" } },
    { loadingScreen: { background: 1.5 } }, { loadingScreen: { background: 2147483648 } },
    { gameplayConstants: { Misc: { HeroMaxLevel: 25 } } }, { gameInterface: { "bad]": {} } },
    { gameplayConstants: { Misc: { X: "a\nY=b" } } }, { gameInterface: { Frame: { X: "a", x: "b" } } },
    { gameplayConstants: { Misc: {}, misc: {} } }]) assert.throws(() => validateMapSettings(value));
  const settings = validateMapSettings({ info: { name: "Name" } });
  assert.throws(() => patchMapInfo(new Uint8Array(2), settings), /Truncated/);
  assert.throws(() => patchMapInfo(new Uint8Array(40), settings), /Unsupported/);
  const truncated = new Uint8Array(30).fill(65);
  new DataView(truncated.buffer).setInt32(0, 39, true);
  assert.throws(() => patchMapInfo(truncated, settings), /Unterminated/);
});

Deno.test("text overrides preserve unrelated sections, comments, line endings and duplicate keys", () => {
  const original = "// header\r\n[Misc]\r\nHeroMaxLevel=10\r\nKeep=42\r\n[Other]\r\nX=y\r\n[Misc]\r\nheromaxlevel=12\r\n";
  const sections = { Misc: { HeroMaxLevel: "25", NewValue: "0" }, CustomSkin: { Text: "" } };
  const patched = patchSettingsText(original, sections);
  assert(patched.includes("// header\r\n[Misc]\r\nHeroMaxLevel=25\r\nKeep=42"));
  assert(patched.includes("[Other]\r\nX=y"));
  assert(patched.includes("heromaxlevel=25"));
  assert(patched.includes("NewValue=0"));
  assert(patched.includes("[CustomSkin]\r\nText="));
  assert.equal(patchSettingsText(patched, sections), patched);
  assert.equal(patchSettingsText(original, {}), original);
});

Deno.test("settings planning leaves source unchanged and changes survive map archive creation", () => {
  const root = Deno.makeTempDirSync({ prefix: "w3ts-settings-" });
  try {
    const source = new URL("war3map.w3i", fixture);
    const file = path.join(root, "war3map.w3i");
    Deno.copyFileSync(source, file);
    Deno.copyFileSync(new URL("war3map.lua", fixture), path.join(root, "war3map.lua"));
    const original = Deno.readFileSync(file);
    assert.deepEqual(evaluateMapSettings(root), validateMapSettings({}));
    assert.deepEqual(planMapSettings(root, {}), []);
    const changes = planMapSettings(root, { info: { name: "Packaged name" }, gameplayConstants: { Misc: { HeroMaxLevel: "25" } }, gameInterface: { CustomSkin: { Test: "value" } } });
    assert.deepEqual(Deno.readFileSync(file), original);
    assert.equal(changes.length, 4);
    for (const change of changes) Deno.writeFileSync(change.file, change.bytes);
    const output = path.join(root, "result.w3x");
    createMapFromDir(output, root);
    const map = new War3Map();
    map.load(toArrayBuffer(Deno.readFileSync(output)));
    assert.deepEqual(new Uint8Array(map.get("war3map.w3i")!.arrayBuffer()!), changes[0].bytes);
    assert.equal(map.get("war3mapMisc.txt")!.text(), "[Misc]\nHeroMaxLevel=25");
    assert.equal(map.get("war3mapSkin.txt")!.text(), "[CustomSkin]\nTest=value");
  } finally { Deno.removeSync(root, { recursive: true }); }
});

Deno.test("editor v39 loading screen fields leave the four-byte extension and entire tail intact", () => {
  const bytes = Deno.readFileSync(new URL("war3map.w3i", fixture));
  // Independent golden offsets from the editor file; do not derive with our reader.
  assert.deepEqual([...bytes.subarray(141, 145)], [64, 0, 0, 0]);
  assert.deepEqual([...bytes.subarray(145, 149)], [0, 0, 0, 0]);
  const replacement = new TextEncoder().encode("Loading.mdx\0Text\0Title\0Subtitle\0");
  const expected = new Uint8Array(bytes.length - 4 + replacement.length);
  expected.set(bytes.subarray(0, 145));
  expected.set(replacement, 145);
  expected.set(bytes.subarray(149), 145 + replacement.length);
  assert.deepEqual(patchMapInfo(bytes, validateMapSettings({ loadingScreen: { model: "Loading.mdx", text: "Text", title: "Title", subtitle: "Subtitle" } })), expected);
});

Deno.test("editor v39 records agree with independently recorded editor Lua and offsets", () => {
  const bytes = Deno.readFileSync(new URL("war3map.w3i", fixture));
  const map = readMapInfo(bytes, true), d = map.details!;
  assert.equal(d.fog.start.start, 161);
  assert.equal(d.fog.start.value, 3000);
  assert.equal(d.soundEnvironment.start, 205);
  assert.equal(d.players[0].id.start, 279);
  assert.equal(d.players[0].fixedStart.start, 295);
  assert.equal(d.players[0].x.start, 311);
  assert.deepEqual(d.players.map(p => [p.id.value, p.controller.value, p.race.value, p.x.value, p.y.value]), [[0,1,1,128,-896], [1,1,2,128,-896], [2,1,3,128,-896], [3,1,4,128,-896], [11,2,4,128,-896]]);
  assert.equal(d.forces[0].flags.start, 563);
  assert.equal(d.forces[1].players.value, 2048);
});

Deno.test("player, force, environment and typed gameplay settings coordinate metadata and Lua", () => {
  const root = path.fromFileUrl(fixture);
  const before = Deno.readFileSync(new URL("war3map.w3i", fixture));
  const changes = planMapSettings(root, {
    info: { name: 'A "quoted" map\n雪', description: "New description" },
    players: { 0: { name: "Hero", controller: "computer", race: "orc", fixedStart: false, x: 256 } },
    forces: { 0: { name: "Allies", allied: false, sharedVision: false, alliedVictory: true, sharedControl: true } },
    environment: { soundEnvironment: "Mountains", waterColor: [10, 20, 30, 255], fog: { enabled: true, start: 100, end: 1000, color: [255, 0, 128, 255] } },
    gameplay: { heroMaxLevel: 25, foodLimit: 200 },
  });
  const map = readMapInfo(changes[0].bytes, true), d = map.details!;
  assert.deepEqual(d.players.slice(0, 1).map(p => [p.name.value, p.controller.value, p.race.value, p.fixedStart.value, p.x.value, p.y.value]), [["Hero",2,2,0,256,-896]]);
  assert.equal(d.forces[0].name.value, "Allies");
  assert.equal(d.forces[0].flags.value, 18);
  assert.equal(d.soundEnvironment.value, "Mountains");
  assert.deepEqual(d.waterColor.map(f => f.value), [10,20,30,255]);
  const lua = new TextDecoder().decode(changes.find(c => c.file.endsWith(".lua"))!.bytes);
  for (const line of ['SetMapName("A \\"quoted\\" map\\010雪")', 'SetPlayerController(Player(0), MAP_CONTROL_COMPUTER)', 'SetPlayerRacePreference(Player(0), RACE_PREF_ORC)', 'DefineStartLocation(0, 256, -896)', 'SetWaterBaseColor(10, 20, 30, 255)', 'NewSoundEnvironment("Mountains")', 'SetPlayerAllianceStateAllyBJ(Player(0), Player(1), false)', 'ALLIANCE_SHARED_CONTROL, true', 'SetTerrainFogEx(0, 100, 1000, 0.5, 1, 0, 0.5019607843137255)']) assert(lua.includes(line), line);
  assert(!lua.includes('ForcePlayerStartLocation(Player(0)'));
  assert(lua.includes('ForcePlayerStartLocation(Player(1), 1)'));
  assert(lua.includes('BlzCreateUnitWithSkin(p, FourCC("Hblm")'));
  assert(lua.indexOf('SetTerrainFogEx(') < lua.lastIndexOf('CreateAllUnits()'));
  assert.match(new TextDecoder().decode(changes.find(c => c.file.endsWith("war3mapMisc.txt"))!.bytes), /HeroMaxLevel=25\nFoodCeiling=200/);
  assert.deepEqual(Deno.readFileSync(new URL("war3map.w3i", fixture)), before);
  assert.equal(luaString("\t\r\n\\\""), '"\\009\\013\\010\\\\\\""');
});

Deno.test("invalid coordinated settings fail before any map mutation", () => {
  const root = path.fromFileUrl(fixture);
  for (const settings of [
    { players: { 24: {} } }, { players: { 0: { race: "oops" } } }, { players: { 5: { name: "missing" } } },
    { forces: { 3: { allied: true } } }, { environment: { fog: { start: 6000 } } },
    { environment: { waterColor: [0, 0, 0, 256] } }, { gameplay: { foodLimit: 301 } },
    { players: { 0: { typo: null } } }, { environment: { typo: null } },
    { gameplay: { heroMaxLevel: 25 }, gameplayConstants: { misc: { heromaxlevel: "10" } } },
  ]) assert.throws(() => planMapSettings(root, settings));
  const bytes = Deno.readFileSync(new URL("war3map.w3i", fixture));
  for (const length of [145, 157, 250, 280, 570]) assert.throws(() => readMapInfo(bytes.subarray(0, length), true));
});
