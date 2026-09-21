import { loadProjectConfig } from "./shared/config.ts";
import { existsSync } from "@std/fs";
import * as path from "@std/path";

// Serialize runs so edits made during generation are processed after it finishes.
export async function watchProject(): Promise<void> {
  const mapDir = `maps/${loadProjectConfig().mapFolder}`;
  const pending = new Set<string>();
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function drain(): Promise<void> {
    if (running) return;
    running = true;
    try {
      while (pending.size) {
        const task = pending.values().next().value!;
        pending.delete(task);
        const status = await new Deno.Command(Deno.execPath(), {
          args: ["task", task], stdout: "inherit", stderr: "inherit",
        }).spawn().status;
        if (!status.success) console.error(`${task} failed; waiting for another edit.`);
      }
    } finally {
      running = false;
    }
  }
  console.log(`Watching objects/**/*.pkl, map-settings*.pkl and ${mapDir}/**/*.lua`);
  const settingsFiles = ["map-settings.pkl", "map-settings-schema.pkl"].filter(file => existsSync(file));
  const watcher = Deno.watchFs(["objects", mapDir, ...settingsFiles]);
  try {
    for await (const event of watcher) {
      if (!["create", "modify", "remove", "rename"].includes(event.kind)) continue;
      for (const file of event.paths) {
        if (file.endsWith(".pkl")) pending.add(path.basename(file).startsWith("map-settings") ? "settings:check" : "objects:eval");
        if (file.endsWith(".lua")) pending.add("build:defs");
      }
      if (pending.size) {
        clearTimeout(timer);
        timer = setTimeout(() => { void drain(); }, 150);
      }
    }
  } finally {
    clearTimeout(timer);
    watcher.close();
  }
}

if (import.meta.main) await watchProject();
