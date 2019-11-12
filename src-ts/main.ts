import { hello } from 'nwtgck-ts-hello'
import { Destructable, MapPlayer, Unit } from 'w3ts';
import { isDestructableTree, setIsDestructableTreeConfig } from 'is-destructable-tree';
import { LibraryLoader } from 'war3-library-loader';

function tsMain() {
  print(hello());

  const d = new Destructable(FourCC("LTlt"), 0, 0, 0, 0, 1, 0);

  print("isTree: " + isDestructableTree(d));

  const unit = new Unit(MapPlayer.fromIndex(0), FourCC('hfoo'), 0, 0, 0);
  unit.name = "TypeScript!";
}

// Configure libraries
setIsDestructableTreeConfig({ HARVESTER_UNIT_ID: FourCC("opeo") });

// Handle initialization 
function libLoaderLog(libName: string, success: boolean, message: string) {
  print(`Initializing "${libName}": ${success ? 'Success' : 'Failure'}, "${message}"`);
}

LibraryLoader.logFunction = libLoaderLog;
ceres.addHook("main::after", () => LibraryLoader.runInitializers());
ceres.addHook("main::after", () => tsMain());