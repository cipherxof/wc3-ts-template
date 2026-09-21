import assert from "node:assert/strict";
import * as path from "@std/path";
import { applyAssetPlan, assetLocations, collectAssets, planAssets, validateAssetConfig } from "../assets/assets.ts";
import { importPath, readImports, writeImports } from "../assets/imports.ts";
import { createMapFromDir } from "../build.ts";
import { War3Map } from "../shared/warcraft-library.ts";
import MapInfoModule from "mdx-m3-viewer-th/dist/cjs/parsers/w3x/w3i/file.js";
import { copySync } from "@std/fs";

const defaults = { paths: {}, exclude: [] };
function fixture(run: (root: string, map: string, state: string) => void): void {
  const root = Deno.makeTempDirSync({ prefix: "w3ts-assets-" });
  const { mapDir, stateFile } = assetLocations(root, "map.w3x");
  try {
    Deno.mkdirSync(mapDir, { recursive: true });
    Deno.mkdirSync(path.join(root, "assets"));
    run(root, mapDir, stateFile);
  } finally { Deno.removeSync(root, { recursive: true }); }
}
function put(root: string, file: string, value = "asset"): void {
  const destination = path.join(root, ...file.split("/"));
  Deno.mkdirSync(path.dirname(destination), { recursive: true });
  Deno.writeTextFileSync(destination, value);
}
const entries = (map: string) => readImports(Deno.readFileSync(path.join(map, "war3map.imp")));

Deno.test("asset folders and mappings produce exact custom icon paths and preserve editor imports", () => fixture((root, map, state) => {
  const icon = "ReplaceableTextures/CommandButtons/BTNSword.blp";
  const disabled = "ReplaceableTextures/CommandButtonsDisabled/DISBTNSword.blp";
  put(root, `assets/${icon}`);
  put(root, "assets/icons/disabled.blp", "disabled");
  put(root, "assets/credits/readme.txt");
  put(root, "assets/.gitkeep");
  put(map, "war3mapImported/existing.wav", "editor");
  Deno.writeFileSync(path.join(map, "war3map.imp"), writeImports([{ flag: 5, path: "existing.wav" }]));
  const config = { paths: { "icons/disabled.blp": disabled }, exclude: ["credits/"] };
  const plan = planAssets(root, map, state, config);
  assert.equal(plan.assets.length, 2);
  assert.throws(() => Deno.statSync(state), Deno.errors.NotFound);
  applyAssetPlan(plan, state);
  assert.deepEqual(entries(map), [
    { flag: 5, path: "existing.wav" },
    ...plan.assets.map(asset => ({ flag: 13, path: asset.target.replaceAll("/", "\\") })),
  ]);
  assert.equal(Deno.readTextFileSync(path.join(map, disabled)), "disabled");
  assert.equal(planAssets(root, map, state, config).changes.length, 0);
}));

Deno.test("sync updates, renames and deletes only owned assets; staged builds do not change source state", () => fixture((root, map, state) => {
  put(root, "assets/Models/unit.mdx", "first");
  put(map, "unmanaged.txt", "keep");
  applyAssetPlan(planAssets(root, map, state, defaults), state);
  const previous = Deno.readTextFileSync(state);
  put(root, "assets/Models/unit.mdx", "second");
  const staged = path.join(root, "stage");
  copySync(map, staged);
  applyAssetPlan(planAssets(root, staged, state, defaults));
  assert.equal(Deno.readTextFileSync(path.join(staged, "Models/unit.mdx")), "second");
  assert.equal(Deno.readTextFileSync(path.join(map, "Models/unit.mdx")), "first");
  assert.equal(Deno.readTextFileSync(state), previous);
  applyAssetPlan(planAssets(root, map, state, defaults), state);
  const renamed = { paths: { "Models/unit.mdx": "Models/renamed.mdx" }, exclude: [] };
  applyAssetPlan(planAssets(root, map, state, renamed), state);
  assert.throws(() => Deno.statSync(path.join(map, "Models/unit.mdx")), Deno.errors.NotFound);
  assert.equal(Deno.readTextFileSync(path.join(map, "Models/renamed.mdx")), "second");
  Deno.removeSync(path.join(root, "assets/Models/unit.mdx"));
  applyAssetPlan(planAssets(root, map, state, defaults), state);
  assert.equal(entries(map).length, 0);
  assert.equal(Deno.readTextFileSync(path.join(map, "unmanaged.txt")), "keep");
}));

Deno.test("conflicts and edited managed files fail before mutation, including deletion", () => fixture((root, map, state) => {
  put(root, "assets/a.blp");
  put(map, "a.blp", "editor owned");
  assert.throws(() => planAssets(root, map, state, defaults), /conflicts/);
  assert.equal(Deno.readTextFileSync(path.join(map, "a.blp")), "editor owned");
  Deno.removeSync(path.join(map, "a.blp"));
  applyAssetPlan(planAssets(root, map, state, defaults), state);
  put(map, "a.blp", "manual edit");
  assert.throws(() => planAssets(root, map, state, defaults), /modified/);
  Deno.removeSync(path.join(root, "assets/a.blp"));
  assert.throws(() => planAssets(root, map, state, defaults), /modified/);
  assert.equal(Deno.readTextFileSync(path.join(map, "a.blp")), "manual edit");
}));

Deno.test("invalid paths, missing mappings, reserved names and duplicate targets are rejected", () => fixture((root, map, state) => {
  put(root, "assets/a.blp");
  put(root, "assets/b.blp");
  for (const destination of ["../escape", "/absolute", "C:\\escape", "war3map.lua", "war3map.imp", "scripts/war3map.j", "CON.blp", "bad.", "a//b"]) {
    assert.throws(() => collectAssets(root, { paths: { "a.blp": destination }, exclude: [] }), /path/i);
  }
  assert.throws(() => collectAssets(root, { paths: { missing: "x.blp" }, exclude: [] }), /does not exist/);
  assert.throws(() => collectAssets(root, { paths: { "a.blp": "X.blp", "b.blp": "x.blp" }, exclude: [] }), /collision/);
  assert.throws(() => collectAssets(root, { paths: { "a.blp": "x", "b.blp": "x/y" }, exclude: [] }), /collision/);
  assert.throws(() => collectAssets(root, { paths: { "a.blp": "x" }, exclude: ["a.blp"] }), /excluded/);
  assert.throws(() => validateAssetConfig({ paths: [], exclude: [] }));
  assert.throws(() => validateAssetConfig({ typo: true }));
  put(map, "Textures", "file");
  assert.throws(() => planAssets(root, map, state, { paths: { "a.blp": "textures/a.blp" }, exclude: [] }), /not a directory/);
}));

Deno.test("existing directory case is reused and forged state cannot delete map internals", () => fixture((root, map, state) => {
  put(map, "Textures/existing.blp");
  put(root, "assets/textures/new.blp");
  const plan = planAssets(root, map, state, defaults);
  assert.equal(plan.assets[0].target, "Textures/new.blp");
  put(root, path.relative(root, state).replaceAll("\\", "/"), JSON.stringify({ version: 1, files: { "war3map.lua": "0".repeat(64) } }));
  assert.throws(() => planAssets(root, map, state, defaults), /Reserved/);
}));

Deno.test("sync rolls back earlier writes when a later write fails", () => fixture((root, map, state) => {
  put(root, "assets/a.blp");
  put(root, "assets/b.blp");
  const plan = planAssets(root, map, state, defaults);
  // A target becoming a directory forces failure after the earlier file write.
  Deno.mkdirSync(path.join(map, "b.blp"));
  assert.throws(() => applyAssetPlan(plan, state));
  assert.throws(() => Deno.statSync(path.join(map, "a.blp")), Deno.errors.NotFound);
  assert.throws(() => Deno.statSync(path.join(map, "war3map.imp")), Deno.errors.NotFound);
  assert(Deno.statSync(path.join(map, "b.blp")).isDirectory);
}));

Deno.test("new target directories share consistent casing and symlink trees are rejected", () => fixture((root, map, state) => {
  put(root, "assets/a.blp");
  put(root, "assets/b.blp");
  const plan = planAssets(root, map, state, { paths: { "a.blp": "Textures/a.blp", "b.blp": "textures/b.blp" }, exclude: [] });
  assert.deepEqual(plan.assets.map(asset => asset.target), ["Textures/a.blp", "Textures/b.blp"]);
  const external = path.join(root, "external");
  Deno.mkdirSync(external);
  Deno.symlinkSync(external, path.join(root, "assets/linked"), { type: Deno.build.os === "windows" ? "junction" : "dir" });
  assert.throws(() => collectAssets(root, defaults), /Symlinks/);
  Deno.removeSync(path.join(root, "assets/linked"));
}));

Deno.test("import index round trips custom and default flags and rejects corrupt data", () => {
  const input = [{ flag: 5, path: "default.blp" }, { flag: 13, path: "Textures\\custom.blp" }];
  assert.deepEqual(readImports(writeImports(input)), input);
  assert.equal(importPath(input[0]), "war3mapImported\\default.blp");
  assert.throws(() => readImports(new Uint8Array([1, 0])));
  assert.throws(() => readImports(writeImports(input).subarray(0, 12)));
});

Deno.test("packaged assets preserve bytes and import index without registering map internals", () => fixture((root, map, state) => {
  put(root, "assets/Models/unit.mdx", "binary fixture");
  put(map, "war3map.lua", "-- source");
  const info = new MapInfoModule.default();
  info.version = 31;
  Deno.writeFileSync(path.join(map, "war3map.w3i"), new Uint8Array(info.save()));
  applyAssetPlan(planAssets(root, map, state, defaults));
  const imp = Deno.readFileSync(path.join(map, "war3map.imp"));
  const archive = path.join(root, "out.w3x");
  createMapFromDir(archive, map);
  const result = new War3Map();
  result.load(Deno.readFileSync(archive));
  assert.deepEqual(new Uint8Array(result.get("war3map.imp")!.arrayBuffer()!), imp);
  assert.equal(new TextDecoder().decode(result.get("Models\\unit.mdx")!.arrayBuffer()!), "binary fixture");
  assert.deepEqual(result.getImportNames(), ["Models\\unit.mdx"]);
}));
