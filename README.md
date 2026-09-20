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
