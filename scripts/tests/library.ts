import assert from "node:assert/strict";
import * as path from "@std/path";
import { exportPaths, librariesInSync, syncLibraries, writeLibraryPaths } from "../library/sync.ts";
import { createBuildConfig, entryArgument } from "../compile.ts";
import { loadProjectConfig } from "../shared/config.ts";
import { loadJsonFile, removeIfExists } from "../shared/files.ts";
import { plugin as wcraftLintPlugin } from "../lint/wcraft-rules.ts";
const test = Deno.test;

function writeJson(file: string, value: unknown): void {
  Deno.mkdirSync(path.dirname(file), { recursive: true });
  Deno.writeTextFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

/** A project with a linked library checkout: <root>/game and <root>/lib. */
function linkedProject(): { root: string; game: string } {
  const root = Deno.makeTempDirSync({ prefix: "w3ts-library-" });
  const game = path.join(root, "game");
  const lib = path.join(root, "lib");
  writeJson(path.join(lib, "deno.json"), {
    name: "@demo/lib", version: "0.1.0",
    exports: { ".": "./mod.ts", "./feature": "./feature/index.ts", "./feature/core": "./feature/core.ts" },
    publish: { exclude: ["tests/"] },
  });
  Deno.writeTextFileSync(path.join(lib, "mod.ts"), "export const x = 1;\n");
  Deno.mkdirSync(path.join(lib, "feature"), { recursive: true });
  Deno.writeTextFileSync(path.join(lib, "feature/index.ts"), 'export * from "./core.ts";\n');
  Deno.writeTextFileSync(path.join(lib, "feature/core.ts"), "export const y = 2;\n");
  Deno.mkdirSync(path.join(lib, "tests"), { recursive: true });
  Deno.writeTextFileSync(path.join(lib, "tests/x.test.ts"), "// not published\n");
  Deno.writeTextFileSync(path.join(lib, "README.md"), "not TypeScript\n");
  writeJson(path.join(game, "deno.json"), { links: ["../lib"] });
  writeJson(path.join(game, "tsconfig.json"), { compilerOptions: { paths: { "@objectdata/*": ["./node_modules/x/*"] } } });
  writeJson(path.join(game, "config.json"), {
    mapFolder: "map.w3x", minifyScript: false, gameExecutable: "game.exe", outputFolder: "dist/bin", launchArgs: [],
    libraries: ["@demo/lib"],
  });
  return { root, game };
}

test("library exports map to version-less paths inside .lib", () => {
  assert.deepEqual(exportPaths("@demo/lib", { ".": "./mod.ts", "./physics/knockback": "./physics/knockback/index.ts" }), {
    "@demo/lib": ["./.lib/@demo/lib/mod.ts"],
    "@demo/lib/physics/knockback": ["./.lib/@demo/lib/physics/knockback/index.ts"],
  });
});

test("library paths replace only .lib entries and leave tsconfig alone when unchanged", () => {
  const dir = Deno.makeTempDirSync({ prefix: "w3ts-library-paths-" });
  try {
    const file = path.join(dir, "tsconfig.json");
    writeJson(file, { compilerOptions: { paths: { "@objectdata/*": ["./x/*"], "@old/lib": ["./.lib/@old/lib/mod.ts"] } } });
    assert.equal(writeLibraryPaths(dir, { "@demo/lib": ["./.lib/@demo/lib/mod.ts"] }), true);
    assert.deepEqual(loadJsonFile<{ compilerOptions: { paths: unknown } }>(file).compilerOptions.paths, {
      "@objectdata/*": ["./x/*"], "@demo/lib": ["./.lib/@demo/lib/mod.ts"],
    });
    const before = Deno.readTextFileSync(file);
    assert.equal(writeLibraryPaths(dir, { "@demo/lib": ["./.lib/@demo/lib/mod.ts"] }), false);
    assert.equal(Deno.readTextFileSync(file), before);
  } finally {
    removeIfExists(dir);
  }
});

test("a project without libraries is in sync and never touches .lib", () => {
  const { root, game } = linkedProject();
  try {
    assert.equal(librariesInSync(game, []), true);
    assert.equal(librariesInSync(game, ["@demo/lib"]), false);
  } finally {
    removeIfExists(root);
  }
});

test("syncing a linked library copies its published TypeScript and maps its exports", async () => {
  const { root, game } = linkedProject();
  try {
    await syncLibraries(game, loadProjectConfig(game).libraries ?? []);
    const target = path.join(game, ".lib/@demo/lib");
    assert.equal(await Deno.readTextFile(path.join(target, "feature/core.ts")), "export const y = 2;\n");
    await assert.rejects(() => Deno.stat(path.join(target, "tests/x.test.ts")), Deno.errors.NotFound);
    await assert.rejects(() => Deno.stat(path.join(target, "README.md")), Deno.errors.NotFound);
    const paths = loadJsonFile<{ compilerOptions: { paths: Record<string, string[]> } }>(path.join(game, "tsconfig.json")).compilerOptions.paths;
    assert.deepEqual(paths, {
      "@objectdata/*": ["./node_modules/x/*"],
      "@demo/lib": ["./.lib/@demo/lib/mod.ts"],
      "@demo/lib/feature": ["./.lib/@demo/lib/feature/index.ts"],
      "@demo/lib/feature/core": ["./.lib/@demo/lib/feature/core.ts"],
    });
    // Linked checkouts change while you work on them, so they always re-sync.
    assert.equal(librariesInSync(game, ["@demo/lib"]), false);
    // Removing the library from config.json removes its copy and paths.
    await syncLibraries(game, []);
    await assert.rejects(() => Deno.stat(path.join(game, ".lib")), Deno.errors.NotFound);
    assert.deepEqual(loadJsonFile<{ compilerOptions: { paths: unknown } }>(path.join(game, "tsconfig.json")).compilerOptions.paths, {
      "@objectdata/*": ["./node_modules/x/*"],
    });
    assert.equal(librariesInSync(game, []), true);
  } finally {
    removeIfExists(root);
  }
});

test("a library that is not a dependency fails with the command to add it", () => {
  const { root, game } = linkedProject();
  try {
    writeJson(path.join(game, "deno.json"), {});
    assert.throws(() => librariesInSync(game, ["@demo/lib"]), /deno add jsr:@demo\/lib/);
  } finally {
    removeIfExists(root);
  }
});

test("config.libraries must hold JSR package names", () => {
  const { root, game } = linkedProject();
  try {
    const file = path.join(game, "config.json");
    const config = loadJsonFile<Record<string, unknown>>(file);
    writeJson(file, { ...config, libraries: ["wc3-lib"] });
    assert.throws(() => loadProjectConfig(game), /config.libraries/);
    writeJson(file, { ...config, libraries: undefined });
    assert.equal(loadProjectConfig(game).libraries, undefined);
  } finally {
    removeIfExists(root);
  }
});

test("--entry is read in both forms and needs a path", () => {
  assert.equal(entryArgument([]), undefined);
  assert.equal(entryArgument(["--entry", "a/main.ts"]), "a/main.ts");
  assert.equal(entryArgument(["-minify", "--entry=a/main.ts"]), "a/main.ts");
  assert.throws(() => entryArgument(["--entry"]), /needs a file path/);
  assert.throws(() => entryArgument(["--entry", "-minify"]), /needs a file path/);
});

test("build config with an entry bundles that entry without touching tsconfig.json", () => {
  const before = Deno.readTextFileSync("tsconfig.json");
  const filename = createBuildConfig(loadProjectConfig(), "src/main.ts");
  try {
    assert.equal(Deno.readTextFileSync("tsconfig.json"), before);
    const generated = loadJsonFile<{
      include: string[]; tstl: { luaBundleEntry: string }; compilerOptions: { plugins: Array<{ entryFile: string }> };
    }>(filename);
    assert.equal(generated.tstl.luaBundleEntry, "./src/main.ts");
    assert.deepEqual(generated.include, ["src", "./src/main.ts"]);
    assert.equal(generated.compilerOptions.plugins[0].entryFile, path.resolve("src/main.ts"));
  } finally {
    removeIfExists(filename);
  }
  assert.throws(() => createBuildConfig(loadProjectConfig(), "src/missing.ts"), /does not exist/);
});

test("Lua lint rules apply to src/ only", () => {
  const denoLint = (Deno as unknown as {
    lint?: { runPlugin: (plugin: unknown, filename: string, source: string) => Array<{ id: string }> };
  }).lint;
  assert(denoLint, "Deno.lint is required for lint plugin tests");
  const ids = (filename: string, code: string) => denoLint.runPlugin(wcraftLintPlugin, filename, code).map(d => d.id).sort();
  const code = [
    "try { f(); } finally { g(); }",
    "const fs: (() => number)[] = []; for (let i = 0; i < 3; i++) fs.push(() => i);",
    "const a = 1, b = 2; const c = a - b || 3;",
  ].join("\n");
  assert.deepEqual(ids("src/game.ts", code), ["wcraft-rules/lua-loop-closure", "wcraft-rules/lua-no-finally", "wcraft-rules/lua-truthiness"]);
  assert.deepEqual(ids("scripts/tool.ts", code), []);
  assert.deepEqual(ids("src/ok.ts", "for (let i = 0; i < 3; i++) { const index = i; fs.push(() => index); }"), []);
});
