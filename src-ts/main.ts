/** @noSelfInFile **/

import { File } from "./lib/file-io";

function tsMain(){
    print("Hello World!");

    File.write("ts.pld", "Welcome to TypeScript!");
}

ceres.addHook("main::after", () => tsMain());