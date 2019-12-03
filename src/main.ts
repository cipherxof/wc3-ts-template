import { MapPlayer, Unit, addScriptHook } from 'w3ts';

function tsMain() {
  const unit = new Unit(MapPlayer.fromIndex(0), FourCC("hfoo"), 0, 0, 270);
  unit.name = "TypeScript";

  print("Welcome to TypeScript!");
}

addScriptHook("main::after", tsMain);