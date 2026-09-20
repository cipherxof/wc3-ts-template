# Installation

You need a Warcraft III: Reforged installation with a Lua-capable World Editor for editing and playing. Older
JASS-only versions will not work. The pinned native typings are for Warcraft III 1.33.0; this is not a promise that every game version supports every declared native.

## 1. Prerequisites

Install [Deno](https://deno.com/), [Pkl](https://pkl-lang.org) and [git](https://git-scm.com/).

Run to verify:
```powershell
deno --version
git --version
pkl --version
```
If Pkl is missing from PATH run:

```powershell
$env:PKL_EXECUTABLE = 'path\to\pkl.exe'
```

## 2. Clone this repo

```powershell
git clone https://github.com/mdlsvensson/w3ts-framework.git
cd w3ts-framework
```

## 3. Install project dependencies

```powershell
deno install --frozen
```

Deno downloads the locked dependencies and manages `node_modules/`. An internet
connection is needed for uncached packages. Do not run `npm install` or maintain a
second package-manager lockfile. `package.json` declares npm dependencies;
`deno.lock` locks the actual resolution. Build tools use Deno's Node compatibility
layer without requiring a standalone Node installation.

## 4. Configure the game executable

Open `config.json` in your editor and set the path to your `Warcraft III.exe`:

```json
{
  "gameExecutable": "C:\\Games\\Warcraft III\\_retail_\\x86_64\\Warcraft III.exe"
}
```

* If there are multiple editors on the same project, create a local config and set your personal path by copying `config.json` --> `config.local.json`. Leave shared map settings in `config.json` so collaborators build the same map.
* Use double backslashes in JSON strings, or forward slashes. Point to the game executable, not the World Editor or Battle.net launcher.
* See [configuration](reference.md#configuration) for all options.

## 5. Check the setup and build

```powershell
deno task typecheck
deno task lint
deno task test:unit
deno task build
```

Each command should finish successfully. The build evaluates Pkl, compiles the
gameplay code into Lua, applies object data, and packages `dist/bin/map.w3x`.
The intermediate `dist/map.w3x/` is a directory; the file inside `dist/bin/` is the distributable map file.

## 6. Play the sample

```powershell
deno task test
```

This rebuilds and launches `dist/map.w3x/` with Warcraft III. Expect printed build
information and a Footman at the map origin that changes color every second.

## 7. Set up Visual Studio Code

Open the repository folder in Visual Studio Code and install the recommended Deno extension.
The checked-in settings enable Deno for `scripts/` only. `src/` uses the gameplay
`tsconfig.json` and TypeScript-to-Lua types.

[Pkl language support](https://pkl-lang.org/vscode/current/index.html) is optional but useful for schema completion. Generated schemas and base constants are already included; no regeneration is required for a normal installation.

Next: [use your own map](custom-maps.md) or [write your first gameplay code](map-making.md).
