import { addScriptHook, MapPlayer, Timer, Unit } from 'w3ts';

function tsMain() {
  const unit = new Unit(MapPlayer.fromIndex(0), FourCC("hfoo"), 0, 0, 270);
  unit.name = "TypeScript";

  new Timer().start(1.00, true, () => {
    unit.color = ConvertPlayerColor(math.random(0, bj_MAX_PLAYERS));
  });

  print("Welcome to TypeScript!");
}

addScriptHook("main::after", tsMain);