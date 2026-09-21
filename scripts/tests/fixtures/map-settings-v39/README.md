# World Editor fixture

Copied unchanged from this project's source map on 2026-09-21. The header records
Warcraft III 3.0.0.24268, map-info format 39. This is actual editor output, not a
fixture serialized by the library under test.

`war3map.w3i` SHA-256:
`969a64caa8c04393fd79dc0418378e410fa1cb33f0fe2a39f6cc3761646438ce`

The Lua file provides an independent cross-check of player IDs, controllers,
races, fixed starts, coordinates and force membership. Unit tests pin binary
offsets and preservation of untouched bytes. They do not prove game acceptance.

Format-39 observations used by the reader:

- Four bytes between loading background and model path (offset 141, value 64).
- A 24-byte block after weather and before sound environment.
- A 40-byte block after the three camera zoom values and before player count.
- Four bytes between each player's race and fixed-start flag (value 64, matching
  `RACE_PREF_USER_SELECTABLE` race skin in the accompanying Lua).

Unknown fields are preserved verbatim. These observations establish this fixture's
layout; they do not identify every new field or establish when it was introduced.
Legacy layout reference: https://github.com/ChiefOfGxBxL/WC3MapSpecification/blob/master/Info/0-33.md
