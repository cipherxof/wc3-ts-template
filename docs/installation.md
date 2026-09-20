# Installation

This guide takes a fresh Windows setup to the first map build. You need a Warcraft
III installation with a Lua-capable World Editor for editing and playing. Older
JASS-only versions are outside this framework's scope. The pinned native typings
are for Warcraft III 1.33.0; this is not a promise that every game version supports
every declared native.

## 1. Install the tools

Install Git from [Git for Windows](https://gitforwindows.org/), or download and
extract this repository's ZIP if you do not need Git history.

Install Deno using PowerShell:

```powershell
winget install --id DenoLand.Deno --exact
```

Open a new terminal and verify:

```powershell
git --version
deno --version
```

Use Deno **2.9.6 or newer within major version 2**. If an installer provides another
major version, select a compatible Deno 2 release. See the official
[Deno installation guide](https://docs.deno.com/runtime/getting_started/installation/)
for alternative installers. The framework pins its gameplay TypeScript compiler
separately; Deno's displayed TypeScript version may differ.

Install the **Pkl CLI 0.32.1**. On Windows x64, download `pkl-windows-amd64.exe` from
the [official release](https://github.com/apple/pkl/releases/tag/0.32.1), put it in a
stable folder such as `C:\Tools\Pkl`, and rename it `pkl.exe`. Add that folder to
your user `Path` through Windows' Environment Variables settings, then reopen the
terminal. Alternatively, set its path in each terminal where you work:

```powershell
$env:PKL_EXECUTABLE = 'C:\Tools\Pkl\pkl.exe'
& $env:PKL_EXECUTABLE --version
```

If using `Path`, verify with `pkl --version`. The VS Code Pkl extension does not
replace the CLI. Other platforms should use the matching executable from the
[Pkl CLI installation guide](https://pkl-lang.org/main/current/pkl-cli/index.html).

## 2. Get the framework

```powershell
git clone https://github.com/mdlsvensson/w3ts-framework.git
cd w3ts-framework
```

For a ZIP download, extract it and open a terminal in the folder containing
`deno.json`, `package.json`, and `config.json`. Choose a writable project location.

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

Create a personal override if you do not already have one:

```powershell
Copy-Item config.local.example.json config.local.json
```

Open `config.local.json` in your editor and set the executable's actual path:

```json
{
  "gameExecutable": "C:\\Games\\Warcraft III\\_retail_\\x86_64\\Warcraft III.exe"
}
```

Use double backslashes in JSON strings, or forward slashes. Point to the game
executable, not the World Editor or Battle.net launcher. `config.local.json` is
ignored by Git. Leave shared map settings in `config.json` so collaborators build
the same map. See [configuration](reference.md#configuration) for all options.

## 5. Check the setup and build

```powershell
deno task typecheck
deno task lint
deno task test:unit
deno task build
```

Each command should finish successfully. The build evaluates Pkl, compiles the
gameplay code into Lua, applies object data, and packages `dist/bin/map.w3x`.
The intermediate `dist/map.w3x/` is a directory; the file inside `dist/bin/` is the
archive you distribute. You can build without an installed game; only launching
needs a working game executable.

## 6. Play the sample

```powershell
deno task test
```

This rebuilds and launches `dist/map.w3x/` with Warcraft III. Expect printed build
information and a Footman at the map origin that changes player color every second.
The command may remain active until the game exits. If direct launching fails,
build the archive and open it from Warcraft III's Custom Games map browser after
copying it into your game's user Maps folder.

## 7. Set up your code editor

Open the repository folder in VS Code and install its recommended Deno extension.
The checked-in settings enable Deno for `scripts/` only. `src/` uses the gameplay
`tsconfig.json` and TypeScript-to-Lua types. Enabling Deno for the entire workspace
can cause misleading gameplay diagnostics.

Pkl language support is optional and useful for schema completion. Generated
schemas and base constants are already included; no regeneration is required for
a normal installation.

Next: [use your own map](custom-maps.md) or [write your first gameplay code](map-making.md).
