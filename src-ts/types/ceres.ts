/** @noSelfInFile **/

declare abstract class ceres {
    static addHook(this:void, hookName: string, callback: () => void): void;
    static setMain(callback: () => void): void;
    static setConfig(callback: () => void): void;
    static wrapCatch(callback: () => void): (...any: any) => void
    //function catch(callback: () => void, ...any: any): void; //TS wont let me define a function called catch.
}

/**
 * Will load the module from either /lib/ or /src/
 * @example
 * let mymodule = require("mymodule");
 * mymodule.DoSomething();
 */
declare function require(name: string): any;

/**
 * This macro will inject the contents of the specified file into the source
 * where it is called. Paths are relative to the project's root.
 * @example
 * include("src/resource/somestuff")
 */
declare function include(path: string): void;

/**
 * @param any Expression to be evaluated by Ceres.
 * @example
 * print(compiletime(2 + 2)) //print(4)
 * print(compiletime("my string is" + " really epic")) //print("my string is really epic")
 * print(compiletime(() => {
 *  const a = 1;
 *  const b = 2;
 *  return a + b;
 * })) //Compiles to print(3)
 */
declare function compiletime(any: any): any;