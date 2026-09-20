# Make your first map

Start with a working [installation](installation.md). This walkthrough uses the
template map and creates a custom Footman with Pkl, then spawns it with TypeScript.
Use a fresh checkout or back up your existing definitions before replacing files.

## 1. Define a custom unit

Replace `objects/definitions/units.pkl` with:

```pkl
module wc3.definitions.units

import "../schema.pkl" as schema
import "../bases.pkl" as bases

units: Mapping<String, schema.RegularUnit> = new {
  ["vanguard"] = new schema.RegularUnit {
    id = "u001"
    base = bases.Units.Footman
    name = "Vanguard"
    hitPointsMaximumBase = 650
    goldCost = 120
    speedBase = 300
  }
}
```

`vanguard` is the friendly key used by your code. `u001` is the four-character
engine ID, also called a rawcode. The new unit inherits the Footman's unspecified
fields. Keep this ID unique across your map and all Pkl definitions.

Run:

```powershell
deno task objects:eval
```

Inspect `src/generated/objects.json`: it should contain `units.vanguard.id` with
the value `u001`. Do not edit that JSON; it is regenerated from Pkl. Evaluation
checks Pkl types, while the subsequent build also checks actual base objects,
property names, and collisions with your source map.

## 2. Spawn the unit

Replace `src/main.ts` with:

```typescript
import { Unit } from "w3ts";
import { Players } from "w3ts/globals";
import { addScriptHook, W3TS_HOOK } from "w3ts/hooks";
import * as objects from "./generated/objects.json";

function startGame(): void {
  const vanguard = Unit.create(
    Players[0],
    FourCC(objects.units.vanguard.id),
    0,
    0,
    270,
  );
  if (!vanguard) {
    print("Could not create the Vanguard.");
    return;
  }
  print("Your Vanguard is ready at the center of the map.");
}

addScriptHook(W3TS_HOOK.MAIN_AFTER, startGame);
```

The hook runs after the editor-generated `main`, so editor initialization has
already taken place. `Players[0]` is the first player slot. Coordinates are world
coordinates; choose a walkable point inside your map's playable bounds if `(0, 0)`
is unsuitable. `FourCC` converts a string rawcode to the numeric ID the game uses.

Importing the generated manifest keeps the unit's ID in one source of truth. Run
`objects:eval` after adding or renaming Pkl keys before running `typecheck`; builds
evaluate Pkl automatically. Standard constants such as `Units.Footman` from
`@objectdata/units` describe built-in objects, not your new custom objects.

## 3. Build and play

```powershell
deno task typecheck
deno task build
deno task test
```

Look for the startup message, then inspect the Vanguard's name and maximum health.
If the source map's Object Editor does not list it, that is expected: the build
injects Pkl definitions into the staged map. Spawn Pkl objects in code. For objects
that must be placed visually in the editor, maintain those objects in the source
map's Object Editor using distinct IDs.

You can also build and open the packaged archive separately to inspect its object
data. Treat that as a disposable inspection copy; do not save it back over source.

## 4. Add gameplay modules

Keep `src/main.ts` as the startup point and move larger systems into imported files.
For example, create `src/gameplay/welcome.ts`:

```typescript
export function showWelcome(): void {
  print("Defend the village!");
}
```

Import `showWelcome` from `./gameplay/welcome` in `src/main.ts` and call it inside
`startGame`. Unreferenced gameplay modules are not a substitute for startup hooks:
import the modules your entry point needs.

Code under `src/` runs inside Warcraft III after transpilation to Lua. Use Warcraft
natives and `w3ts`, not `Deno`, Node filesystem APIs, browser DOM APIs, or network
calls. TypeScript acceptance alone does not guarantee that a JavaScript feature is
supported by the Lua transpiler; run a full build and playtest after substantial changes.

Destroy timers, triggers, groups, effects, and other handles when their work is
finished. In multiplayer, keep gameplay changes synchronized between clients;
local-player-only UI behavior must not change shared game state.

## 5. Use World Editor globals

Place units, regions, or cameras in the source map and save it. Then run:

```powershell
deno task build:defs
```

Open `src/war3map.d.ts` to find the exact exported names. These declarations provide
types for values created by the map's Lua script; they do not create handles.
For example, if that file contains `gg_rct_Arena`, code inside your startup hook
can use `GetRectCenterX(gg_rct_Arena)` and `GetRectCenterY(gg_rct_Arena)` as spawn
coordinates.

Do not invent or manually declare a global merely to silence a type error. The
editor must actually emit it in `war3map.lua`. Some preplaced objects need to be
referenced by an editor trigger before a named global is generated. Save, regenerate
the declarations, and inspect the output after renaming or removing editor objects.

## 6. Iterate on your map

In one terminal:

```powershell
deno task dev
```

Edit Pkl files to regenerate the manifest, or save the source map to regenerate
Lua-global declarations. The watcher does not build the archive, watch TypeScript,
or reload a running game. It performs no initial generation, so run `objects:eval`
and `build:defs` once if their outputs are stale. Use another terminal for `build`
or `test` after generation finishes. Stop the watcher with Ctrl+C.

After a successful build, share `dist/bin/<mapFolder>`. Test that exact archive in
the game before distribution. Continue with the [object-data reference](object-data.md)
to add abilities, items, heroes, and upgrades.
