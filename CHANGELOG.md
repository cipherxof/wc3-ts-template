# Changelog

## Unreleased

- Automatic folder-based resource imports with optional Pkl custom-path mappings
  and exclusions, shared by packed builds and directory playtests.
- `assets:check` and `assets:sync` for explicit World Editor source-map imports,
  with hash-based ownership, collision checks, stale removal, and I/O rollback.
- Preserve the staged import index during packaging and use Warcraft backslash
  archive paths; internal map files are no longer registered as imported assets.
- Asset regression tests and a separate real-Pkl CLI integration test.

## 0.1.0-alpha.1 — release preparation

Initial alpha of w3ts-framework, based on wc3-ts-template.

### Included

- Deno-managed dependencies and tasks for the TypeScript-to-Lua toolchain.
- Pkl authoring for heroes, units, buildings, items, abilities, buffs, and upgrades.
- Generated base constants and typed engine properties, with rawcode validation,
  inheritance, aliases, and contextual manifest errors.
- Standard/skin object-table preservation and explicit buff/upgrade injection.
- Source-map staging, MPQ packaging, optional Lua minification, and game launching.
- World Editor global declaration generation and Pkl/Lua file watching.
- Warcraft-specific FourCC linting, JSON configuration validation, and regression tests.
- Local configuration overrides, actionable setup errors, and user-facing guides.

### Alpha limitations

- Schemas and tool APIs may change before a stable release.
- Numeric per-level ability/upgrade arrays are unsupported by the pinned object library.
- Pkl objects appear in build output, not automatically in the source Object Editor.
- Watch mode regenerates data/declarations; it does not rebuild or hot-reload gameplay.
- Builds in one checkout share output paths and should run serially.
- A failed build can leave older packaged output; check command success.
- Modern map metadata is preserved through a targeted compatibility path, not a
  guarantee for every game/editor format.
- Wine and non-Windows workflows are unverified. In-game and editor smoke tests
  remain a release gate; see [the release checklist](CONTRIBUTING.md#alpha-release-checklist).
