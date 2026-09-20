# Pkl object authoring

Pkl describes custom Warcraft III objects as typed, version-controlled text.
It runs during development and building; no Pkl runtime is included in the map.

## Modules and data flow

`objects/objects.pkl` amends `objects/schema.pkl` and merges the category mappings
from `objects/definitions/*.pkl`. The root schema exposes the authoring classes
and registries. `objects/schema/types.pkl` constrains rawcodes and selected enums;
`objects/schema/generated/` supplies properties derived from the pinned object-data
library. `objects/bases.pkl` supplies built-in unit, item, and ability constants.

```text
definitions/*.pkl + schema + bases
              |
         Pkl evaluation
              |
   src/generated/objects.json
              |
  validation and object injection
              |
   dist/<mapFolder>/war3map*.w3*
```

Edit definitions and, when necessary, handwritten schema modules. Generated files
are outputs. Run `deno task objects:eval` to evaluate without compiling gameplay.
A full build always evaluates the manifest again.

## Categories and IDs

| Registry / file | Class | Custom ID rule | Base |
| --- | --- | --- | --- |
| `heroes` / `heroes.pkl` | `schema.Hero` | Uppercase initial, e.g. `H001` | `bases.Units.Paladin` |
| `units` / `units.pkl` | `schema.RegularUnit` | Lowercase initial, e.g. `u001` | `bases.Units.Footman` |
| `buildings` / `buildings.pkl` | `schema.Building` | Lowercase initial, e.g. `b001` | `bases.Units.Barracks` |
| `items` / `items.pkl` | `schema.Item` | Initial `I`, e.g. `I001` | `bases.Items.ClawsOfAttackPlus15` |
| `abilities` / `abilities.pkl` | `schema.Ability` | Initial `A`, e.g. `A001` | Built-in ability constant or rawcode |
| `buffs` / `buffs.pkl` | `schema.Buff` | Initial `B`, e.g. `B001` | Rawcode such as `BHbz` |
| `upgrades` / `upgrades.pkl` | `schema.Upgrade` | Initial `R`, e.g. `R001` | Rawcode such as `Rhme` |

IDs contain exactly four alphanumeric characters and are case sensitive. Explicit
`id` values are required in typed Pkl definitions. Mapping keys can be descriptive
names such as `vanguard`; they do not determine the engine ID. The JSON loader can
fall back to the key when `id` is omitted, but that is not the typed Pkl workflow.

Pkl rejects standard unit/item/ability IDs using generated sets. The build also
rejects duplicate IDs across the manifest and IDs already present in the target
game/map table. Heroes, regular units, and buildings all share that unit table.

Unit, item, and ability bases must be among the generated built-in IDs. Buff and
upgrade bases are rawcode strings validated against their tables at build time.
You cannot use another newly declared Pkl object as `base`: all bases are resolved
before custom objects are created. Reuse Pkl definitions through classes or object
amendment instead.

## A complete manifest example

The normal project splits categories across files. This equivalent standalone
example can be saved as `objects/example.pkl` and evaluated with
`pkl eval -f json objects/example.pkl`. It does not become part of the build unless
you integrate its definitions into `objects/objects.pkl` or the existing files.

```pkl
amends "schema.pkl"

import "schema.pkl" as schema
import "bases.pkl" as bases

heroes {
  ["captain"] = new schema.Hero {
    id = "H001"
    base = bases.Units.Paladin
    name = "Captain"
    primaryAttribute = "STR"
  }
}
units {
  ["guard"] = new schema.RegularUnit {
    id = "u001"
    base = bases.Units.Footman
    name = "Guard"
    goldCost = 100
    normal = List("Adef")
  }
}
buildings {
  ["barracks"] = new schema.Building {
    id = "b001"
    base = bases.Units.Barracks
    name = "Garrison"
  }
}
items {
  ["claws"] = new schema.Item {
    id = "I001"
    base = bases.Items.ClawsOfAttackPlus15
    name = "Veteran's Claws"
    goldCost = 200
  }
}
abilities {
  ["heal"] = new schema.Ability {
    id = "A001"
    base = "AHhb"
    name = "Field Medicine"
    manaCost = 25
    cooldown = 8.0
  }
}
buffs {
  ["blizzard"] = new schema.Buff {
    id = "B001"
    base = "BHbz"
    name = "Custom Blizzard"
  }
}
upgrades {
  ["weapons"] = new schema.Upgrade {
    id = "R001"
    base = "Rhme"
    name = "Veteran Weapons"
    goldBase = 100
  }
}
```

Creating these definitions makes the objects available; it does not automatically
add an ability to a unit, an item to a shop, or an upgrade to a building. Configure
the relevant object fields or gameplay logic separately.

## Properties and inheritance

An omitted or `null` field inherits the base value. Explicit `0`, `false`, `""`,
and `List()` are overrides, so an empty ability list clears inherited abilities.
`schema.Building` sets `isABuilding = true`; other unspecified fields still inherit.

Use the generated property files as the exhaustive property reference. Each field
has a Pkl type and comments identifying the engine field. For example, unit
`hitPointsMaximumBase` is an integer, `speedBase` is an integer, and `normal` is a
list of ability rawcodes. Standard Pkl type checking catches misspelled top-level
fields and incompatible values during evaluation.

The optional `properties` mapping accepts friendly or library property names and
overrides top-level values. For example, inside a unit definition:

```pkl
goldCost = 100
properties = new {
  ["goldCost"] = 0
  ["abilities"] = List("Adef")
}
```

This makes the unit free and sets its normal abilities. `null` inside `properties`
does not erase a supplied top-level override. This mapping bypasses Pkl's individual
field types, so prefer typed top-level properties whenever possible.

Aliases include `abilities` → unit `normal`, `heroAbilities` → unit `hero`,
`movementType` → library `type`, `upgradeClass` → library `class`, and friendly
tinting-color names. Buff `name` maps to `nameEditorOnly`. Some library names have
an `undefined` suffix; friendly names remove it. Aliases are category dependent.

The mapping is not a raw four-character field-ID API: use `goldCost`, for example,
not a metadata field rawcode. Unknown properties and `oldId`/`newId` overrides are
rejected. List properties become comma-separated engine strings.

## Limits to design around

- Numeric ability/upgrade fields are scalars in the pinned object-data library.
  Per-level arrays such as `cooldown = List(8, 6, 4)` are unsupported and rejected.
- Pkl supports these seven registries. Doodads and destructibles are not authoring
  registries, although existing map tables are loaded and saved.
- Names and other strings are literal values; there is no automatic localization
  table generator.
- Validation does not prove that a model path exists or that all cross-object
  references and gameplay effects work. Playtest them.
- Generated metadata reflects the pinned dependency, not a scan of your installed
  Warcraft III data. Not every newer editor property is necessarily represented.

## Split larger projects into modules

Create a module exporting a typed mapping, import it into the relevant definitions
file, and merge it with Pkl's spread syntax, as the root manifest already does:

```pkl
import "factions/human.pkl" as human

units: Mapping<String, schema.RegularUnit> = new {
  ...human.units
}
```

Retain the existing `schema` import in that definitions file. Files are not discovered
automatically: every new module needs an import path leading from `objects/objects.pkl`.
Keep mapping keys unique when merging, as well as rawcodes unique across objects.

Run `deno task bases:gen` after intentionally updating object metadata dependencies;
it regenerates constants and property schemas. `deno task schema:gen` regenerates
only property schemas. Review generated diffs and rebuild afterward.
