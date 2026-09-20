/** Opt-in integration checks: requires the real Pkl executable. */
import assert from "node:assert/strict";
import * as path from "@std/path";
import { evaluateAssetConfig } from "../assets.ts";
import { importPath, readImports } from "../asset-imports.ts";

Deno.test("Pkl mappings and real asset CLI check/sync work in an isolated map", () => {
  const root = Deno.makeTempDirSync({ prefix: "w3ts-assets-pkl-" });
  try {
    Deno.copyFileSync(new URL("../../assets-schema.pkl", import.meta.url), path.join(root, "assets-schema.pkl"));
    Deno.mkdirSync(path.join(root, "assets/icons"), { recursive: true });
    Deno.writeTextFileSync(path.join(root, "assets/icons/BTNTest.blp"), "icon bytes");
    Deno.writeTextFileSync(path.join(root, "assets/icons/DISBTNTest.blp"), "disabled bytes");
    Deno.writeTextFileSync(path.join(root, "assets.pkl"), String.raw`amends "assets-schema.pkl"
paths {
  ["icons/BTNTest.blp"] = "ReplaceableTextures\\CommandButtons\\BTNTest.blp"
  ["icons/DISBTNTest.blp"] = "ReplaceableTextures\\CommandButtonsDisabled\\DISBTNTest.blp"
}
`);
    const config = evaluateAssetConfig(root);
    assert.equal(config.paths["icons/BTNTest.blp"], "ReplaceableTextures\\CommandButtons\\BTNTest.blp");
    const map = path.join(root, "maps/map.w3x");
    Deno.mkdirSync(map, { recursive: true });
    Deno.writeTextFileSync(path.join(map, "war3map.lua"), "-- source");
    Deno.writeFileSync(path.join(map, "war3map.w3i"), new Uint8Array());
    Deno.writeTextFileSync(path.join(root, "config.json"), JSON.stringify({ mapFolder: "map.w3x", gameExecutable: "game.exe", minifyScript: false, outputFolder: "dist/bin", launchArgs: [] }));
    const run = (mode: string) => new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "--config", path.fromFileUrl(new URL("../../deno.json", import.meta.url)), path.fromFileUrl(new URL("../assets.ts", import.meta.url)), mode],
      cwd: root, stdout: "piped", stderr: "piped",
    }).outputSync();
    const check = run("check");
    assert.equal(check.code, 0, new TextDecoder().decode(check.stderr));
    assert.throws(() => Deno.statSync(path.join(map, "war3map.imp")), Deno.errors.NotFound);
    assert.throws(() => Deno.statSync(path.join(root, ".asset-state")), Deno.errors.NotFound);
    const sync = run("sync");
    assert.equal(sync.code, 0, new TextDecoder().decode(sync.stderr));
    assert.deepEqual(readImports(Deno.readFileSync(path.join(map, "war3map.imp"))).map(importPath), [
      "ReplaceableTextures\\CommandButtons\\BTNTest.blp",
      "ReplaceableTextures\\CommandButtonsDisabled\\DISBTNTest.blp",
    ]);
    assert.equal(Deno.readTextFileSync(path.join(map, "ReplaceableTextures/CommandButtons/BTNTest.blp")), "icon bytes");
    assert.equal(run("sync").code, 0);
    // Schema rejects a numeric target before the filesystem plan is constructed.
    Deno.writeTextFileSync(path.join(root, "assets.pkl"), 'amends "assets-schema.pkl"\npaths { ["icons/BTNTest.blp"] = 42 }');
    assert.throws(() => evaluateAssetConfig(root), /evaluation failed/);
  } finally { Deno.removeSync(root, { recursive: true }); }
});
