# w3ts-framework

**Build Warcraft III maps with TypeScript gameplay and declarative Pkl object data.**

Keep terrain and placements in the World Editor, write game systems in TypeScript,
and define units, heroes, buildings, items, abilities, buffs, and upgrades in text.
One Deno command combines them into a playable `.w3x` archive.

**0.1.0-alpha.1** — an early framework for map makers comfortable working with code.
APIs and authoring schemas may change during alpha. Windows is the primary
development workflow; in-game compatibility depends on your Warcraft III version.

## What you get

- TypeScript-to-Lua compilation and the `w3ts` handle wrappers.
- Typed Pkl definitions with base-object constants, inheritance, and rawcode checks.
- A build pipeline that preserves source-map assets and applies custom object data.
- Generated TypeScript declarations for World Editor globals.
- Deno tasks for building, launching, watching, linting, and regression testing.
- A Lua template map to get started without creating a map from scratch.

## Quickstart

Install **Deno 2.9.6 or newer within Deno 2**, **Pkl 0.32.1**, and Git.
Install Warcraft III and its World Editor to play and edit maps. No separate Node.js
or npm installation is required. See [step-by-step installation](docs/installation.md)
for Windows setup, Pkl executable configuration, and editor support.

```powershell
git clone https://github.com/mdlsvensson/w3ts-framework.git
cd w3ts-framework
deno install --frozen
deno task build
```

The packaged map is **`dist/bin/map.w3x`**. To launch it through the development
workflow, create your local configuration (skip the copy if it already exists):

```powershell
Copy-Item config.local.example.json config.local.json
```

Edit `gameExecutable` in `config.local.json` to match your Warcraft III installation,
then run:

```powershell
deno task test
```

The sample prints build information and creates a Footman whose player color changes
every second. `test` builds and launches the staged map directory; use `test:unit`
for automated tests.

## Your map, three kinds of source

| Location | What you create |
| --- | --- |
| `maps/map.w3x/` | Terrain, placements, imports, and editor triggers |
| `src/` | Gameplay code, starting at `src/main.ts` |
| `objects/definitions/` | Custom object definitions in Pkl |

Builds write to `dist/`. Keep editing the source map in `maps/`; generated output
is replaced on the next build. Pkl definitions become object data during the build
and do not automatically appear in the source map's Object Editor.

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

## Credits and license

Based on TriggerHappy's [wc3-ts-template](https://github.com/cipherxof/wc3-ts-template),
with [w3ts](https://github.com/cipherxof/w3ts), TypeScriptToLua, war3-transformer,
war3-objectdata-th, and mdx-m3-viewer-th. This fork adds Pkl object authoring and a
Deno-based toolchain. Distributed under the [MIT license](LICENSE).
