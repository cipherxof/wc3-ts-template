# Commands and configuration

Run every command from the repository root. `deno.json` owns task definitions;
`package.json` includes optional aliases for most tasks, but Deno is the supported
installer and runner.

## Commands

| Command | Effect | Requirements beyond Deno/dependencies |
| --- | --- | --- |
| `deno install --frozen` | Install dependencies using `deno.lock` | Registry access for uncached packages |
| `deno task build` | Evaluate objects, compile, inject, package the selected map | Pkl, source map |
| `deno task build -minify` | Same build with Lua minification enabled | Pkl, source map |
| `deno task test` | Compile and launch the staged map directory | Pkl, source map, Warcraft III |
| `deno task test:unit` | Automated regression suite | No Pkl or game required |
| `deno task typecheck` | Check tools and gameplay types | Current generated gameplay inputs |
| `deno task lint` | Deno/custom lint followed by JSON/config validation | No Pkl or game required |
| `deno task lint:json` | JSON/config validation only | No Pkl or game required |
| `deno task objects:eval` | Regenerate `src/generated/objects.json` | Pkl |
| `deno task build:defs` | Regenerate editor-global TypeScript declarations | Source-map Lua |
| `deno task dev` | Watch Pkl and map Lua changes; regenerate their outputs | Pkl for object edits, source map |
| `deno task schema:gen` | Regenerate Pkl property schemas | Installed object-data metadata |
| `deno task bases:gen` | Regenerate Pkl base constants, then property schemas | Installed object-data metadata |

`test` is a game launcher, not the regression suite. It does not refresh the packed
archive. `-minify` is supported by `build`; to minify a `test` launch, set
`minifyScript` in configuration. `dev` does not perform an initial build or start
Warcraft III. Restart it after changing `mapFolder`.

## Configuration

`config.json` supplies shared defaults. An optional ignored `config.local.json`
replaces any supplied top-level values. This is a shallow merge: `launchArgs`
replaces the entire array, not individual entries.

| Key | Type / default | Meaning |
| --- | --- | --- |
| `mapFolder` | String, `map.w3x` | A `.w3x` directory name directly under `maps/`; no path separators |
| `minifyScript` | Boolean, `false` | Minify the combined editor/gameplay Lua |
| `gameExecutable` | Nonempty string, example Windows installation path | Warcraft III executable used for launching |
| `outputFolder` | Nonempty string, `./dist/bin` | Directory for packaged archives |
| `launchArgs` | String array, `-launch -windowmode windowed` | Arguments appended after the generated `-loadfile` argument |
| `winePath` | Optional string | Wine executable; enables the Wine launch branch |
| `winePrefix` | Optional string | `WINEPREFIX` environment value for the launched process |

Keep `outputFolder` separate from both your source-map folder and the staging
directory, normally under `dist/`. Changing it does not move staging or the Lua
bundle. Relative paths resolve from the working directory, so run tasks at root.

Configuration validation checks values, not the existence of the game executable;
building does not require Warcraft III. Pkl is configured separately through
`PKL_EXECUTABLE`, falling back to `pkl` on `PATH`. Do not include shell quotes in
the environment variable's value; spaces in the executable path are supported.

Wine support constructs a `Z:` map path and can set a Wine prefix. This is an
experimental path, not a tested Linux installation recipe. macOS/Linux builds
also require platform-appropriate Deno/Pkl executables and independent validation.

## Generated files

| Path | Producer | Git treatment |
| --- | --- | --- |
| `src/generated/objects.json` | `objects:eval`, `build`, `test`, watcher | Tracked; regenerate after definition changes |
| `src/war3map.d.ts` | `build:defs`, watcher | Tracked; regenerate after editor-global changes |
| `objects/bases.pkl` | `bases:gen` | Tracked; review dependency-driven changes |
| `objects/schema/generated/*.pkl` | `schema:gen`, `bases:gen` | Tracked; do not hand-edit |
| `dist/<mapFolder>/` | `build`, `test` | Ignored; staging replaced per build |
| `dist/tstl_output.lua` | Compiler | Ignored; gameplay bundle |
| `<outputFolder>/<mapFolder>` | `build` | Ignored with the default output folder |
| `tsconfig.build.<pid>.json` | Compiler orchestration | Ignored; normally removed automatically |
| `project.log` | CLI logging | Ignored; useful for diagnosing builds |
| `node_modules/` | Deno dependency installation | Ignored |

Do not edit generated JSON or declarations as the source of a fix. Change Pkl or
the World Editor map, then regenerate. Include changed tracked outputs when
committing source changes that affect them.

## Lint behavior

The custom plugin checks direct calls such as `FourCC("hfoo")`. It permits expressions
such as `FourCC(objects.units.vanguard.id)` without evaluating them. Pkl rawcode
constraints are stricter than the lint rule: Pkl requires alphanumeric IDs with
category-specific prefixes, while lint accepts four printable ASCII characters.

Generated files, map assets, and build output are excluded from normal linting.
`deno task lint` also validates JSON syntax and the merged project configuration.
