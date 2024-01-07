import * as fs from "fs-extra";
import { loadJsonFile, logger } from "./utils";

const War3TSTLHelper = require("war3tstlhelper");

const config = loadJsonFile("config.json");

// Create definitions file for generated globals
const luaFile = `./maps/${config.mapFolder}/war3map.lua`;
//Contains all the strings for custom object data
const wtsFile = `./maps/${config.mapFolder}/war3map.wts`;

try {
    const contents = fs.readFileSync(luaFile, "utf8");
    const parser = new War3TSTLHelper(contents);
    const result = parser.genTSDefinitions();
    fs.writeFileSync("src/war3map.d.ts", result);

    const wtsFileContents = fs.readFileSync(wtsFile, "utf8");
    const folderExists = fs.pathExistsSync(config.wtsParserOutputFolder);

    if (folderExists) {
        generateEnumsFromWTSFile(wtsFileContents);
    } else {
        fs.mkdirSync(config.wtsParserOutputFolder);
        generateEnumsFromWTSFile(wtsFileContents);
    }
} catch (err: any) {
    logger.error(err.toString());
    logger.error(`There was an error generating the definition file for '${luaFile}'`);
}


/**
 * Creates enum from the contents of the wts file.
 * 
STRING 8                                            
// Units: H000 (Blood Elf Survivor), Name (Name)    //This line is referred to as the title line
{
Blood Elf Survivor                                  //This line is referred to as the data value line 
}
 * 
 */
function generateEnumsFromWTSFile(fileContents: string) {
    let newFileContents = "";
    type WTS_ObjectTypes = "Units" | "Items" | "Destructibles" | "Doodads" | "Abilities" | "Buffs/Effects" | "Upgrades";

    enum TitleLineWordsIndexMap {
        StartIdentifier,
        ObjectDataTypeIndicator,
        FourCC,
        ObjectNameLimited,
        ObjectDataTypeShort, //tip, ubertip, name, etc.
        ObjectDataTypeLong, //(Name), Tooltip, Tooltip Extended, etc.
    }

    enum Token {
        DataBegin = "{",
        DataEnd = "}",
        TitleLineIndicator = "//",
    }

    enum ObjectDataTypeShort {
        Name = "Name",
        Tooltip = "Tip",
        TooltipExtended = "Ubertip",
        EditorName = "EditorName", //For buffs/effects
        EditorSuffix = "EditorSuffix",
        Hotkey = "Hotkey",
    }

    //To be concatenated together for the new file contents for generated enums
    const objectTypesEnumMembersString = new Map<WTS_ObjectTypes, string>([
        ["Units", ""],
        ["Items", ""],
        ["Destructibles", ""],
        ["Doodads", ""],
        ["Abilities", ""],
        ["Buffs/Effects", ""],
        ["Upgrades", ""],
    ]);

    const {
        units: enumNameUnits,
        items: enumNameItems,
        destructibles: enumNameDestructibles,
        doodads: enumNameDoodads,
        abilities: enumNameAbilities,
        buffsEffects: enumNameBuffsEffects,
        upgrades: enumNameUpgrades,
    } = config.wtsParserGeneratedEnumNames;

    //Used when we create our enums at the end. We can also make this configurable in the config.json file to be to the user's preference
    const objectTypeEnumNames = new Map<WTS_ObjectTypes, string>([
        ["Units", enumNameUnits],
        ["Items", enumNameItems],
        ["Destructibles", enumNameDestructibles],
        ["Doodads", enumNameDoodads],
        ["Abilities", enumNameAbilities],
        ["Buffs/Effects", enumNameBuffsEffects],
        ["Upgrades", enumNameUpgrades],
    ]);

    const uniqueEnumMemberNames = new Map<WTS_ObjectTypes, Set<string>>([
        ["Units", new Set<string>()],
        ["Items", new Set<string>()],
        ["Destructibles", new Set<string>()],
        ["Doodads", new Set<string>()],
        ["Abilities", new Set<string>()],
        ["Buffs/Effects", new Set<string>()],
        ["Upgrades", new Set<string>()],
    ]);

    /**
     * ["//", "Units:", "I000", "(Object Name)", "Name", "(Name)"]
     */
    let titleLineWords: string[] = [];
    /**
     * The line with the content that will be used as the enum member name
     */
    let dataLineValue = "";
    let currentLineWords: string[] = [];
    let lastReadWord = "";
    let concatenatingWordsInProgress = false;
    let firstCompositeWordAdded = false;
    let storeNextLineAsEnumMemberName = false;

    function clearAllStoredValues() {
        storeNextLineAsEnumMemberName = false;
        currentLineWords = [];
        firstCompositeWordAdded = false;
        concatenatingWordsInProgress = false;
        dataLineValue = "";
        titleLineWords = [];
        lastReadWord = "";
    }

    function isTargetedDataType(dataType: string) {
        return dataType == ObjectDataTypeShort.Name || dataType == ObjectDataTypeShort.EditorName;
    }

    for (let x = 0; x < fileContents.length; x++) {
        const char = fileContents[x];
        const nextChar = fileContents[x + 1];

        //End of line - process the values
        if (isEndOfLine(char)) {
            //Title line words are set the same line they are captured
            if (currentLineWords.includes(Token.TitleLineIndicator) && isTargetedDataType(currentLineWords[TitleLineWordsIndexMap.ObjectDataTypeShort])) {
                //Store the title line
                titleLineWords = [...currentLineWords];
            }

            //If we have anything stored from the data section then we can use that to add it do our enum
            if (storeNextLineAsEnumMemberName && currentLineWords.length > 0 && isTargetedDataType(titleLineWords[TitleLineWordsIndexMap.ObjectDataTypeShort])) {
                //Pascal Case
                currentLineWords.forEach((word) => {
                    const chars = word.split("");
                    chars[0] = chars[0].toUpperCase();
                    word = chars.join("");

                    dataLineValue += word;
                });

                // We have all the necessary data at this point - now we can create our enum
                let enumForObjectDataType = titleLineWords[TitleLineWordsIndexMap.ObjectDataTypeIndicator];
                enumForObjectDataType = enumForObjectDataType.replace(":", "");

                const currentEnumString = objectTypesEnumMembersString.get(enumForObjectDataType as WTS_ObjectTypes);

                //Clean word before checking if name is already used
                dataLineValue = removeIllegalCharactersFromEnumMemberName(dataLineValue);

                const enumMemberWordSet = uniqueEnumMemberNames.get(enumForObjectDataType as WTS_ObjectTypes);
                let newEnumMember = `${currentEnumString ? "\n" : ""}\t${dataLineValue} = FourCC("${titleLineWords[TitleLineWordsIndexMap.FourCC]}"),`;

                if (enumMemberWordSet?.has(dataLineValue)) {
                    //Handle duplicate name by appending _FourCC to end of name
                    newEnumMember = `${currentEnumString ? "\n" : ""}\t${dataLineValue}_${titleLineWords[TitleLineWordsIndexMap.FourCC]} = FourCC("${titleLineWords[TitleLineWordsIndexMap.FourCC]}"),`;
                    objectTypesEnumMembersString.set(enumForObjectDataType as WTS_ObjectTypes, currentEnumString + newEnumMember);
                } else {
                    enumMemberWordSet?.add(dataLineValue);
                }

                objectTypesEnumMembersString.set(enumForObjectDataType as WTS_ObjectTypes, currentEnumString + newEnumMember);

                //Reset stored data since we captured the necessary data
                clearAllStoredValues();
            }

            //Current line is reset once we reach end of line
            currentLineWords = [];
            lastReadWord = "";
        }

        //Storing words into the current line 
        if ((isEndOfWord(char) || isEndOfLine(nextChar)) && lastReadWord) {
            //detect if we need to concatenate words
            if (shouldConcatenateWords(lastReadWord)) {
                concatenatingWordsInProgress = true;
            }

            //We have already started making a composite word which means the last item in the array is our composite word
            if (concatenatingWordsInProgress && firstCompositeWordAdded) {
                //Add last read word to it
                currentLineWords[currentLineWords.length - 1] += lastReadWord;
            }

            //If we are making a composite word but haven't started yet, then push the first word into the array
            if (concatenatingWordsInProgress && !firstCompositeWordAdded) {
                currentLineWords.push(lastReadWord);
                firstCompositeWordAdded = true;
            }

            if (!concatenatingWordsInProgress) {
                currentLineWords.push(lastReadWord);
            }

            if (isFinalWordInConcatenationSequence(lastReadWord)) {
                concatenatingWordsInProgress = false;
                firstCompositeWordAdded = false;
            }

            //reset word after we have made use of it
            lastReadWord = "";
        } else if (char !== "\n" && char !== Token.DataBegin && char !== Token.DataEnd) {
            lastReadWord += char;
        }

        //Determine whether or not next line will be used for enum member name
        if (char === Token.DataBegin && titleLineWords.includes(Token.TitleLineIndicator) && isTargetedDataType(titleLineWords[TitleLineWordsIndexMap.ObjectDataTypeShort])) {
            storeNextLineAsEnumMemberName = true;
        }
    }

    //Now we create our enums
    for (const [key, value] of objectTypesEnumMembersString) {
        const newEnumName = objectTypeEnumNames.get(key);

        if (key && value) {
            newFileContents += `\nexport enum ${newEnumName}{\n${value}\n}\n`;
        }
    }

    fs.createFileSync(`${config.wtsParserOutputFolder}/WTS_Enums.ts`);
    fs.writeFileSync(`${config.wtsParserOutputFolder}/WTS_Enums.ts`, newFileContents);
}

/**
 * End of word can be indicated by the current character being an empty space or a newline character
 * @param char
 * @returns
 */
function isEndOfWord(char: string) {
    return char === " ";
}

function isEndOfLine(char: string) {
    return char === "\n";
}

function shouldConcatenateWords(word: string) {
    return word.includes("(") && !word.includes(")");
}

function isFinalWordInConcatenationSequence(word: string) {
    return word.includes(")") || word.includes("),");
}

/**
 * Removes color coding from word for clean enum member names
 * @param word
 * @returns
 */
function removeColorCodingFromWord(word: string) {
    if (word.includes("|cff")) {
        //iterate through word, find every point where there is a |cff then remove the following 9 characters from the word
        for (let x = 0; x < word.length; x++) {
            const char = word[x];
            //Color code sequence detected

            if (char === "|" && word[x + 1] === "c" && word[x + 2] === "f" && word[x + 3] === "f") {
                //remove the color formatting characters
                const chars = word.split("");

                for (let i = x; i < x + 10; i++) {
                    chars[i] = "";
                }

                word = chars.join("");
            }
        }

        return word;
    } else {
        return word;
    }
}

function removeIllegalCharactersFromEnumMemberName(word: string) {
    //Clean word before checking if name is already used
    word = word.replace("(", "");
    word = word.replace(")", "");
    word = word.replace(",", "");
    word = removeColorCodingFromWord(word);
    word = word.replace(/\|n/g, "");
    word = word.replace(/\|r/g, "");

    const pattern = new RegExp("^[A-Za-z0-9]+$");

    //Replace characters not included in the above replace block with _ . Purely opinionated stylistic choice. Nice for replacing - with _
    for (let x = 0; x < word.length; x++) {
        const char = word[x];

        if (!pattern.test(char)) {
            word = word.replace(word[x], "_");
        }
    }

    return word;
}
