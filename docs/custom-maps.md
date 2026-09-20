# Use your own World Editor map

The framework reads an **unpacked map directory**, named with a `.w3x` suffix.
A single packed `.w3x` file cannot be used directly as the source directory.
The source must include the complete map contents, including `war3map.lua` and
`war3map.w3i` at its root.

## 1. Prepare a source map

Back up your map before changing its scripting language or storage format. Open
the original map in the World Editor, or create a new map with your preferred
terrain, size, and player settings.

In **Scenario > Map Options**, select **Lua** as the scripting language and save.
For an existing JASS map, resolve incompatible custom-script triggers before
continuing; this framework does not convert handwritten JASS to Lua. Confirm that
the editor saves successfully.

## 2. Save the map as a directory

Use **File > Save As**, select the directory/folder map format in the save dialog,
and save as `MyMap.w3x` inside this project's `maps/` folder. The wording of the
directory format varies by editor version. Confirm in File Explorer that
`MyMap.w3x` is a folder containing map files, rather than a single archive.

If your editor does not offer directory saving, save a normal Lua `.w3x` archive
and extract its complete contents with an MPQ-capable map archive tool into
`maps/MyMap.w3x/`. A `.w3x` archive is not a ZIP: renaming its extension does not
unpack it. Preserve internal paths, imported assets, and editor data. Repeat the
export/extraction after each editor save, replacing the previous source export so
removed files do not linger. Keep your editable original separately in that workflow.

The resulting layout should resemble:

```text
maps/
  MyMap.w3x/
    war3map.lua
    war3map.w3i
    war3map.w3e
    war3map.wts
    ...remaining map and imported asset files...
```

Do not add an extra nesting level such as `MyMap.w3x/MyMap/war3map.lua`. Copying only
the Lua script loses terrain, placements, and other map data.

## 3. Select the new map

Change `mapFolder` in the root `config.json`:

```json
{
  "mapFolder": "MyMap.w3x",
  "minifyScript": false,
  "gameExecutable": "C:\\Program Files (x86)\\Warcraft III\\_retail_\\x86_64\\Warcraft III.exe",
  "outputFolder": "./dist/bin",
  "launchArgs": ["-launch", "-windowmode", "windowed"]
}
```

The value is only the folder name, not `maps/MyMap.w3x` or an absolute path.
Check that `config.local.json` does not override `mapFolder`. The compiler derives
its map paths from this setting; you do not need to change the template map paths
inside `tsconfig.json`.

Alternatively, keep `mapFolder` as `map.w3x` and replace the template directory
with your complete unpacked map. Move the old directory to a backup first; merging
two maps' contents can leave unwanted object tables and assets behind.

## 4. Refresh declarations and build

```powershell
deno task build:defs
deno task typecheck
deno task build
deno task test
```

`build:defs` replaces `src/war3map.d.ts` with globals from the selected map. Fix any
TypeScript references to globals that only existed in the template. The packed
output is now `dist/bin/MyMap.w3x`; staging uses `dist/MyMap.w3x/`.

If the watcher was running, restart `deno task dev` after changing `mapFolder`.

## 5. Keep source and output separate

Continue saving terrain and placements into the source directory under `maps/`.
When opening a directory map in the editor, use its directory-map opening option;
some versions expose this by selecting the directory's `war3map.w3i` file.
If that is unavailable, use the packed-original and extraction workflow above.

Do not use `dist/` as your editing project. Each build replaces the selected staged
directory. Reusing a built map as source can also append the gameplay bundle twice
and introduce Pkl rawcode collisions.

World Editor object modifications are loaded before Pkl definitions are applied.
Pkl creates new objects; it does not overwrite existing map objects with the same
ID. Give editor-owned objects and Pkl-owned objects different rawcodes.

For the first playtest, check terrain, player starts, imported models, triggers,
and the TypeScript startup message. Then follow the [map-making walkthrough](map-making.md).
