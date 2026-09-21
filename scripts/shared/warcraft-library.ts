// This library publishes transpiled CommonJS modules with exports.default.
// Deno's ESM default import is that exports object, not the nested constructor.
import MapModule from "mdx-m3-viewer-th/dist/cjs/parsers/w3x/map.js";
import SimpleFileModule from "mdx-m3-viewer-th/dist/cjs/parsers/w3x/w3u/file.js";
import LevelFileModule from "mdx-m3-viewer-th/dist/cjs/parsers/w3x/w3d/file.js";

export const War3Map = MapModule.default;
export const SimpleFile = SimpleFileModule.default;
export const LevelFile = LevelFileModule.default;
