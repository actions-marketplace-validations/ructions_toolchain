import { getInput } from "@actions/core";
import { debug } from "@actions/core";
import { existsSync, readFileSync } from "fs";

export interface ToolchainOptions {
    name: string;
    targets: string[];
    default: boolean;
    override: boolean;
    profile: string;
    components: string[];
}

function determineToolchain(overrideFile: string): string {
    const toolchainInput = getInput("toolchain", { required: false });

    if (toolchainInput) {
        debug(`using toolchain from input: ${toolchainInput}`);
        return toolchainInput;
    }

    if (!existsSync(overrideFile)) {
        throw new Error(
            "toolchain input was not given and repository does not have a rust-toolchain file"
        );
    }

    const rustToolchainFile = readFileSync(overrideFile, {
        encoding: "utf-8",
        flag: "r",
    }).trim();

    debug(`using toolchain from rust-toolchain file: ${rustToolchainFile}`);

    return rustToolchainFile;
}

export function getToolchainArgs(overrideFile: string): ToolchainOptions {
    const components: string[] = getInput("components")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => 0 < s.length);

    return {
        name: determineToolchain(overrideFile),
        target: getInput("target"),
        default: getInput("default") === "true",
        override: getInput("override") === "true",
        profile: getInput("profile"),
        components,
    };
}
