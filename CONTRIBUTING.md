# Contributing

Use the [installation guide](docs/installation.md) to set up Deno, Pkl, and the
template. Keep changes focused and update the relevant user guide when a workflow
or public schema changes. Preserve upstream license attribution.

## Before submitting changes

```powershell
deno install --frozen
deno task typecheck
deno task lint
deno task test:unit
deno task test:assets:pkl
deno task build
deno task build -minify
```

Tests exercise property normalization, invalid manifests, rawcode collisions,
all seven categories through binary serialization, file persistence, source-map
validation, configuration isolation, lint, archive preservation, and CLI failures.
They do not replace an in-game test.

Asset tests cover custom/default import paths, ownership conflicts, rollback,
case collisions, symlinks, stale removal, and archive round trips.
`test:assets:pkl` additionally requires Pkl and runs the real check/sync CLI in an
isolated temporary map. For asset changes, also verify a real model and its textures
in World Editor after syncing, saving, and reopening, then play the packed map.

For object-authoring changes, also evaluate representative populated Pkl definitions
and inspect the built objects. Empty registries can build successfully without
exercising a new schema. For gameplay changes, playtest with the intended game version.

Regenerate `src/generated/objects.json` when definitions change and
`src/war3map.d.ts` when map globals change. Keep generated changes alongside their
sources. Avoid unrelated formatting of binary maps or generated metadata.

## Dependencies and generated schemas

Dependencies are declared in `package.json` and `deno.json`; Deno owns installation
and `deno.lock`. When intentionally changing a dependency, use
`deno install --frozen=false` to update the lockfile, review that diff, then confirm
`deno install --frozen` succeeds. Do not add npm/yarn/pnpm lockfiles.

After object-data metadata changes, run `deno task bases:gen` and review constants,
property names, aliases, and schema types. Recheck Pkl examples and binary round
trips. The toolchain pins TypeScript separately from Deno because the Lua compiler
and transformer must work with the same supported TypeScript version.

## Alpha release checklist

1. Run all commands above from a clean checkout with the documented tool versions.
2. Verify generated sources are current and review `git diff` for personal paths
   or unintended map changes.
3. Play the unminified template through `deno task test`; confirm startup output,
   the sample unit, and its timer behavior.
4. Play the exact packaged `.w3x`, including a minified build. Check imports,
   terrain, player settings, editor triggers, and TypeScript initialization.
5. Follow the custom-map guide with a separately saved Lua map. Regenerate globals,
   build, and play it.
6. Exercise custom units, heroes, buildings, items, abilities, buffs, and upgrades
   in-game. Check the fields that binary tests alone cannot establish visually.
7. If the map is multiplayer, test with multiple clients for synchronization issues.
8. Record the Warcraft III and World Editor versions used. Update the changelog,
   package version, and README status together, then tag/publish the reviewed release.

Windows is the primary alpha workflow. Wine launching and other platforms need
their own verification before being described as supported. Do not infer gameplay
or editor compatibility solely from a successful archive build.
