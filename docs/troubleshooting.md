# Troubleshooting

Run commands from the directory containing `deno.json`. Start with the first error
in the terminal; later messages may be consequences. Build/launch CLI logs also
appear in `project.log`. A failed command may leave an older archive behind.

## Tools and installation

| Symptom | Action |
| --- | --- |
| `deno` is not recognized | Reopen the terminal after installation; check `deno --version` and PATH |
| Pkl executable was not found | Install the CLI, run `pkl --version`, or set `PKL_EXECUTABLE` to the actual executable |
| Pkl works in one terminal only | Environment changes are per process; configure PATH or set the variable in the build terminal too |
| npm/JSR package download fails | Check connectivity/proxy access and rerun `deno install --frozen` |
| Frozen lockfile error | Restore matching `package.json`, `deno.json`, and `deno.lock`; do not delete the lockfile to hide a mismatch |
| Deno-specific types appear in gameplay errors | Restore `.vscode/settings.json`; Deno should be enabled only for `scripts/` |

Use [installation](installation.md) for the supported tool versions. The gameplay
compiler version differs from Deno's bundled TypeScript version by design.

## Source maps

**Missing `war3map.lua` or `war3map.w3i`:** check that `maps/<mapFolder>` is a directory
with those files directly inside it. A packed `.w3x` file, an extra nesting level,
or a JASS export will not work. Save in Lua mode and export the full map again.

**Wrong map builds:** inspect both `config.json` and `config.local.json`. A local
`mapFolder` overrides the shared value. Restart the watcher after changing it.

**Assets or editor changes are missing:** save/export the source map before building.
Confirm imports are inside the source map with their original internal paths.
Make sure you are testing the new archive, not an older copy in the game's Maps folder.

**Scripts run twice or object IDs suddenly collide:** confirm you did not replace
the source map with a previously compiled map from `dist/`. Restore the editable
source export and rebuild.

## Object definitions

**Pkl type/constraint error:** use the file and line shown by Pkl. Check field names
in `objects/schema/generated/`, ID prefixes, and the built-in base constants.

**Duplicate or existing ID:** choose an unused rawcode. IDs must be unique across
Pkl categories and must not replace an existing object in the destination table.
Editor-authored custom objects count too.

**Unknown or reserved property:** the `properties` mapping uses friendly/library
names, not raw metadata field codes. `oldId` and `newId` cannot be overridden.

**Per-level array error:** numeric ability/upgrade fields are scalar in this alpha.
An array cannot express level-specific numeric values through this pipeline.

**Object missing from the source Object Editor:** Pkl injection changes the staged
map only. Spawn it in code or inspect a disposable built archive. See
[object authoring](object-data.md) for ownership and inheritance rules.

## TypeScript and gameplay

**A new manifest key is missing from TypeScript:** run `deno task objects:eval`
before `typecheck`, or wait for the watcher to finish. Do not hand-edit the JSON.

**An editor global is missing:** save the source map and run `deno task build:defs`.
Inspect `src/war3map.d.ts` and the map Lua for its real name. Only emitted globals
can be used; a declaration cannot create a missing runtime handle.

**Typecheck passes but compilation fails:** the Lua transpiler supports a different
runtime than ordinary JavaScript. Read its first diagnostic and replace unsupported
APIs/features. Code under `src/` cannot use Deno, Node, or browser APIs.

**Gameplay startup is missing:** confirm your entry module imports the code and
registers a startup hook, then check the combined `dist/<mapFolder>/war3map.lua`.
Use `print` messages and an unminified build to narrow down runtime failures.

## Launching and stale output

**Warcraft III cannot launch:** verify `gameExecutable` points to the installed
game executable. Close other game instances and inspect the terminal error. Direct
launch behavior depends on game version. If needed, build and open the packed
archive through the game's Custom Games browser.

**Watch mode does nothing initially:** it reacts to subsequent Pkl/Lua edits.
Run `objects:eval` and `build:defs` once. It does not watch TypeScript or rebuild
archives; use `build` or `test` explicitly.

**The map seems unchanged after a failed build:** the previous archive is retained.
Only use output after a successful command, and check its modification time. Avoid
simultaneous build/generation commands in the same checkout.

When reporting a bug, include Deno/Pkl/game versions, the command, the first error,
relevant log lines, and a minimal map or definition that reproduces it. Remove
personal paths or unrelated map content from the report where appropriate.
