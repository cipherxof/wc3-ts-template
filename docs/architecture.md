# How the framework works

The repository separates the map's editor data, runtime gameplay, and build tools.
This separation lets the World Editor own terrain while code and object definitions
remain easy to review in Git.

## Source ownership

| Path | Responsibility |
| --- | --- |
| `maps/<mapFolder>/` | Complete unpacked source map, saved/exported by the World Editor |
| `src/main.ts` and other gameplay modules | TypeScript compiled into the map's Lua script |
| `src/war3map.d.ts` | Generated types for editor-created Lua globals |
| `objects/definitions/` | Handwritten Pkl custom objects |
| `objects/schema.pkl`, `objects/schema/` | Public authoring types and generated property schemas |
| `objects/bases.pkl` | Generated built-in object IDs and friendly constants |
| `src/generated/objects.json` | Pkl evaluation output, available to compiler and gameplay imports |
| `scripts/` | Development tools running on Deno, outside the game |
| `dist/` | Replaceable build output |

## Build stages

```text
config.json + optional config.local.json
                  |
           validate source map
                  |
objects/*.pkl -> generated objects.json
                  |
maps/<mapFolder> -> dist/<mapFolder> (fresh copy)
                  |
src/main.ts -> TypeScriptToLua + war3-transformer
                  |
           inject object tables
                  |
     append gameplay Lua to editor Lua
                  |
         optional Lua minification
                  |
      package <outputFolder>/<mapFolder>
```

1. `build.ts` loads and validates configuration. `-minify` enables minification for
   this build even when the configuration is false.
2. `compileMap()` checks for source `war3map.lua` and `war3map.w3i` files. This is
   an early completeness check, not validation of every map binary format.
3. Pkl evaluates `objects/objects.pkl` to JSON. A failed evaluation stops the build.
4. The selected staging directory is replaced by a complete source-map copy. The
   previous Lua bundle is removed. Other staged maps and archives are not cleared.
5. A temporary root-level `tsconfig.build.<pid>.json` contains absolute transformer
   map/entry/output paths. The tracked `tsconfig.json` remains portable and unchanged.
6. The pinned TypeScript-to-Lua CLI runs as a Deno subprocess. `war3-transformer`
   supplies compile-time capabilities and works with the staged map. The temporary
   configuration is removed even if compilation fails.
7. Object injection loads the staged standard and skin tables, validates the full
   manifest, copies base objects with new IDs, and saves the tables. This occurs
   after the transformer so its changes are included.
8. The gameplay bundle is appended to the staged editor Lua. Minification, when
   enabled, operates on the combined script.
9. `build.ts` recursively imports staged files into an MPQ-backed `.w3x` archive.
   `test.ts` uses the same compiler but launches the staged directory instead of
   creating that archive.

Run build, launch, and generation commands serially in a checkout. Separate builds
still share the manifest, staging directory, and Lua bundle; PID-specific compiler
configurations do not make the entire pipeline safe for concurrent builds.

## The two TypeScript environments

`deno.json` configures development scripts with Deno and Node compatibility types.
`tsconfig.json` configures game code with Warcraft native types, `w3ts`, Lua 5.3,
and transformer declarations. `typecheck` checks both environments, using the pinned
TypeScript 5.8.2 compiler for gameplay.

The default entry point is `src/main.ts` and the bundle is `dist/tstl_output.lua`.
`@objectdata/*` resolves built-in constants from the installed object-data package.
Compile-time callbacks such as `compiletime(() => new Date().toUTCString())` run
on the development machine; normal gameplay statements run in Warcraft III.

The sample registers its startup function using `W3TS_HOOK.MAIN_AFTER` to run after
editor initialization. The editor's Lua script remains part of the final map.

## Script reference

| Module | Responsibility |
| --- | --- |
| `config.ts` | Reads base/local JSON, merges top-level settings, validates types and map names |
| `build.ts` | Build command, archive packaging, modern map-info preservation |
| `compile.ts` | Source validation, staging, temporary compiler config, compilation, injection, Lua merge |
| `evaluate-objects.ts` | Runs the Pkl executable and reports missing CLI/setup errors |
| `object-data.ts` | Category resolution, ID/base validation, aliases, inheritance, property normalization |
| `object-files.ts` | Reads/writes standard and skin object tables and invokes manifest application |
| `warcraft-library.ts` | Adapts CommonJS constructor exports from the pinned Warcraft parsing library |
| `test.ts` | Compiles and launches Warcraft III, with optional Wine settings |
| `dev.ts` | Parses source-map Lua globals into `src/war3map.d.ts` |
| `watch.ts` | Debounces file events and serializes Pkl/declaration regeneration |
| `generate-pkl-bases.ts` | Generates built-in ID types, collision sets, and named constants |
| `generate-pkl-schema.ts` | Converts metadata fields to nullable Pkl properties using shared aliases |
| `validate-json.ts` | Checks configuration JSON syntax and merged project configuration |
| `lint/wcraft-rules.ts` | Checks literal `FourCC` arguments for four printable ASCII characters |
| `files.ts` | JSON persistence and recursive removal helper |
| `utils.ts` | Sorted file traversal, byte-buffer conversion, logging, subprocess/CLI error handling |
| `tests/run.ts` | Regression tests for data, binaries, packaging, configuration, tools, and lint |

Despite its filename, `dev.ts` is the one-shot `build:defs` implementation.
The `dev` task runs `watch.ts`.

## Object serialization

Heroes, units, and buildings map to the same unit table. Other authored categories
map to items, abilities, buffs, or upgrades. The loader handles simple tables
(`w3u`, `w3t`, `w3b`, `w3h`) and leveled tables (`w3d`, `w3a`, `w3q`), including
their `war3mapSkin.*` counterparts. The pinned library determines which changes
are written to standard versus skin files.

Validation queues all object copies before applying them, so a bad manifest cannot
partially create custom objects in memory. The existing map modifications are
loaded first. This layer explicitly handles buffs/upgrades that the transformer
does not cover.

The archive writer has a compatibility path for map-info version 39 with a 1.31+
build prefix: it preserves the metadata bytes and saves the archive directly,
avoiding an older parser that cannot read all newer fields. This does not establish
compatibility with every future map format; actual game/editor testing is required.

## Failures and generated state

Build CLI failures return a nonzero exit code and are logged to `project.log`.
Subprocess failures are checked explicitly. A failed build can leave a previous
archive and partial staging output, so never interpret an existing archive alone
as success. The next successful build starts from the source map again.

Tasks use `-A` because compiler plugins, compile-time callbacks, external commands,
and file generation require broad access. Run projects and dependencies you trust.
The launcher keeps Node's `execFile` compatibility API to display a visible Warcraft
III window on Windows. Wine launch options exist but remain unverified.
