import { existsSync } from "@std/fs";
import * as path from "@std/path";
import { ObjectData, ModificationFiles } from "war3-objectdata-th/dist/cjs/objectdata.js";
import { SimpleFile, LevelFile } from "../shared/warcraft-library.ts";
import { applyObjectData } from "./data.ts";

/** The transformer omits buffs/upgrades; handle every object table here. */
export function injectObjectData(mapDir: string, manifest: unknown): void {
  const files: ModificationFiles = {};
  const simple = ["w3u", "w3t", "w3b", "w3h"] as const;
  const leveled = ["w3d", "w3a", "w3q"] as const;
  for (const extension of [...simple, ...leveled]) {
    for (const skin of [false, true]) {
      const filename = path.join(mapDir, `war3map${skin ? "Skin" : ""}.${extension}`);
      if (!existsSync(filename)) continue;
      const file = (leveled as readonly string[]).includes(extension) ? new LevelFile() : new SimpleFile();
      file.load(Deno.readFileSync(filename));
      // Both file formats implement the same load/save interface.
      Object.assign(files, { [`${extension}${skin ? "Skin" : ""}`]: file });
    }
  }
  const data = new ObjectData();
  data.load(files);
  applyObjectData(data, manifest);
  for (const [key, file] of Object.entries(data.save())) {
    if (!file) continue;
    const extension = key.replace(/Skin$/, "");
    Deno.writeFileSync(path.join(mapDir, `war3map${key.endsWith("Skin") ? "Skin" : ""}.${extension}`), new Uint8Array(file.save()));
  }
}
