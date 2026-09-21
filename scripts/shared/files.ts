/** Like fs-extra's remove: ignore missing paths, but surface other failures. */
export function removeIfExists(filename: string): void {
  try {
    Deno.removeSync(filename, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

export function loadJsonFile<T = Record<string, unknown>>(filename: string): T {
  try {
    return JSON.parse(Deno.readTextFileSync(filename)) as T;
  } catch (error) {
    throw new Error(`Cannot read ${filename}: ${error}`);
  }
}

export function writeJsonFile(filename: string, value: unknown, options: { spaces?: number } = {}): void {
  Deno.writeTextFileSync(filename, JSON.stringify(value, null, options.spaces) + "\n");
}
