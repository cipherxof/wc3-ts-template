# w3ts-framework

**Build Warcraft III maps with TypeScript gameplay and declarative Pkl object data.**

- TypeScript-to-Lua compilation with `TSTL`.
- Typed **Pkl** definitions with base-object constants, inheritance, and rawcode validation.
- **Deno** build pipeline, with tasks for building, launching, watching, linting, and regression testing.
- Generated **TypeScript** declarations for **World Editor** globals.

## Structure

| Location | What |
| --- | --- |
| `maps/map.w3x/` | Terrain, placements, imports, and editor triggers |
| `src/` | Gameplay code, starting with `src/main.ts` |
| `objects/definitions/` | Custom object definitions in Pkl |
| `assets/` | Models, textures, icons, sounds, and other imported files |
| `assets.pkl` | Optional custom import paths and exclusions |
| `map-settings.pkl` | Map metadata, loading screen, gameplay constants, and interface overrides |
| `scripts/` | Build pipeline, compilation, testing, and developer tooling |

Builds write to `dist/`. Keep editing the source map in `maps/`; generated output
is replaced on the next build. Pkl definitions become object data during the build
and do not automatically appear in the source map's Object Editor.

## Quickstart

Install [Deno](https://deno.com/), [Pkl](https://pkl-lang.org) and [git](https://git-scm.com/).

```powershell
git clone https://github.com/mdlsvensson/w3ts-framework.git
cd w3ts-framework
deno install --frozen
deno task build
```

Edit `gameExecutable` in `config.json` to match your Warcraft III installation,
then run:

```powershell
deno task test
```

## Import resources without the Import Manager

Put files under `assets/`. Their relative paths become custom paths in the map:
`assets/ReplaceableTextures/CommandButtons/BTNMySword.blp` becomes
`ReplaceableTextures\CommandButtons\BTNMySword.blp`.
Build and test include them automatically. Use `assets.pkl` for path overrides.

```powershell
deno task assets:check
# Close the map in World Editor before syncing source-map files.
deno task assets:sync
```

Reopen the source map to use the imports in World Editor. Commit the generated
`.asset-state/` files with source-map changes; they track ownership so later syncs
can safely update or remove managed imports. Never delete this state to resolve a
conflict. See the [asset import guide](https://wc3.dev/framework/docs/assets/).

## Map settings in Pkl

Edit `map-settings.pkl` to override internal map settings during `build` and `test`:

```pkl
amends "map-settings-schema.pkl"

info {
  name = "My Map"
  author = "Your name"
  description = "A cooperative adventure."
  recommendedPlayers = "1-4"
}
loadingScreen {
  title = "Welcome"
  text = "Work together to win."
}
gameplay {
  heroMaxLevel = 25
}
```

Run `deno task settings:check` to evaluate and validate without changing map files.
Missing or null metadata fields inherit the source map; `""` clears text. The
entire file is optional. Overrides apply to the staged map in `dist/`.

`info` and `loadingScreen` patch `war3map.w3i`, preserving other fields and existing
`TRIGSTR` references. Loading screens also support `subtitle`, `model` (an imported
in-map path), and `background` (World Editor index, or `-1` for a custom model).
Models must be imported separately through `assets/`.

`gameplayConstants` merges section/key strings into `war3mapMisc.txt`;
`gameInterface` does the same for `war3mapSkin.txt`. Use the game's exact section
and field names. Values use Warcraft's raw text format, including comma-separated
lists; the framework checks structure, not whether the game recognizes a key.
Unspecified entries and comments are retained. Null does not delete text-file keys.

Supported map-info versions are 18, 25, 28, 31, 32, 33, and 39; version 18 cannot
set a custom loading-screen model. Existing player slots and forces, fog, water
colour and sound environment can also be overridden, with coordinated Lua updates
(version 28+ Lua maps). Terrain, slot counts, force membership, weather, lighting
and HD water parameters remain editor-authored. See the [map settings guide](https://wc3.dev/framework/docs/map-settings/)
for fields, examples and verification limits.
`dev` validates edits to the settings files; rebuild to apply them.
Run `deno task test:settings:pkl` for schema integration tests (requires Pkl).

## Development checks

```powershell
deno task typecheck
deno task lint
deno task test:unit
deno task build
```

The first three commands do not require Pkl or Warcraft III. Building requires Pkl;
playing requires Warcraft III. `deno task dev` watches Pkl and editor Lua changes
to regenerate data and declarations; run `build` or `test` when ready to try changes.

## Documentation

- [Installation](docs/installation.md) — tools, dependencies, configuration, first build.
- [Use your own map](docs/custom-maps.md) — replace the template with a World Editor map.
- [Make your first map](docs/map-making.md) — custom units, gameplay, editor globals, iteration.
- [Pkl object authoring](docs/object-data.md) — schemas, categories, properties, and constraints.
- [How the framework works](docs/architecture.md) — build stages and every `scripts/` module.
- [Commands and configuration](docs/reference.md) — tasks, settings, generated files.
- [Troubleshooting](docs/troubleshooting.md) — common setup, compiler, object, and launch failures.
- [Contributing and release checks](CONTRIBUTING.md) — development checks and alpha playtest checklist.
- [Changelog](CHANGELOG.md) — alpha scope and known limitations.

## Credits and license

Based on TriggerHappy's [wc3-ts-template](https://github.com/cipherxof/wc3-ts-template),
with [w3ts](https://github.com/cipherxof/w3ts), TypeScriptToLua, war3-transformer,
war3-objectdata-th, and mdx-m3-viewer-th. This fork adds Pkl object authoring and a
Deno-based toolchain. Distributed under the [MIT license](LICENSE).
