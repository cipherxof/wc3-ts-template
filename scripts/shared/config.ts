import { existsSync } from "@std/fs";
import { loadJsonFile } from "./files.ts";
import * as path from "@std/path";

export interface IProjectConfig {
  mapFolder: string;
  minifyScript: boolean;
  gameExecutable: string;
  outputFolder: string;
  launchArgs: string[];
  winePath?: string;
  winePrefix?: string;
}

export function readConfig(file: string) {
  const value = loadJsonFile(file);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${file} must contain an object.`);
  return value;
}

export function loadProjectConfig(root = Deno.cwd()): IProjectConfig {
  const configPath = path.join(root, "config.json");
  const configLocalPath = path.join(root, "config.local.json");
  const config = { ...readConfig(configPath), ...(existsSync(configLocalPath) ? readConfig(configLocalPath) : {}) };

  // Validation
  for (const key of ["mapFolder", "gameExecutable", "outputFolder"]) {
    if (typeof config[key] !== "string" || !config[key].trim()) throw new Error(`config.${key} must be a nonempty string.`);
  }
  if (typeof config.mapFolder !== "string" || !/^[^\\/:]+\.w3x$/i.test(config.mapFolder)) throw new Error("config.mapFolder must be a .w3x folder name, without a path.");
  if (typeof config.minifyScript !== "boolean") throw new Error("config.minifyScript must be a boolean.");
  if (!Array.isArray(config.launchArgs) || !config.launchArgs.every((arg: unknown) => typeof arg === "string")) {
    throw new Error("config.launchArgs must be an array of strings.");
  }

  // TODO: Check if -load with maps even works through wine. Further testing required
  for (const key of ["winePath", "winePrefix"]) {
    if (config[key] !== undefined && typeof config[key] !== "string") throw new Error(`config.${key} must be a string.`);
  }
  return config as unknown as IProjectConfig;
}
