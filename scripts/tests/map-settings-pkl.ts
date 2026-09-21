/** Opt-in integration checks using the real Pkl executable. */
import assert from "node:assert/strict";
import * as path from "@std/path";
import { evaluateMapSettings } from "../map-settings.ts";

Deno.test("map settings Pkl schema evaluates overrides and rejects invalid values", () => {
  const root = Deno.makeTempDirSync({ prefix: "w3ts-settings-pkl-" });
  try {
    Deno.copyFileSync(new URL("../../map-settings-schema.pkl", import.meta.url), path.join(root, "map-settings-schema.pkl"));
    const module = path.join(root, "map-settings.pkl");
    Deno.copyFileSync(new URL("../../map-settings.pkl", import.meta.url), module);
    assert.deepEqual(evaluateMapSettings(root).info, {});
    Deno.writeTextFileSync(module, `amends "map-settings-schema.pkl"
info {
  name = "Test map"
  author = ""
}
loadingScreen {
  background = -1
  model = "Loading.mdx"
  title = "Welcome"
}
gameplayConstants { ["Misc"] { ["HeroMaxLevel"] = "25" } }
gameInterface { ["CustomSkin"] { ["Test"] = "" } }
players { ["0"] { controller = "computer"
race = "orc"
x = 256.0
fixedStart = false } }
forces { ["0"] { alliedVictory = true } }
environment {
  waterColor = new { 20
40
80
255 }
  fog { enabled = true
start = 100.0
end = 1000.0
density = 0.5 }
}
gameplay { heroMaxLevel = 25
foodLimit = 200 }
`);
    const settings = evaluateMapSettings(root);
    assert.equal(settings.info.name, "Test map");
    assert.equal(settings.info.author, "");
    assert.equal(settings.loadingScreen.background, -1);
    assert.equal(settings.gameplayConstants.Misc.HeroMaxLevel, "25");
    assert.equal(settings.players[0].x, 256);
    assert.deepEqual(settings.environment.waterColor, [20, 40, 80, 255]);
    assert.equal(settings.forces[0].alliedVictory, true);
    assert.equal(settings.gameplay.foodLimit, 200);
    for (const invalid of ['info { typo = "x" }', 'loadingScreen { background = -2 }', 'gameplayConstants { ["Misc"] { ["HeroMaxLevel"] = 25 } }', 'info { name = "bad\\u{0}name" }']) {
      Deno.writeTextFileSync(module, `amends "map-settings-schema.pkl"\n${invalid}`);
      assert.throws(() => evaluateMapSettings(root), /evaluation failed/);
    }
  } finally { Deno.removeSync(root, { recursive: true }); }
});
