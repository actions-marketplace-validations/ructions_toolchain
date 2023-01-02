import { getInput } from "@actions/core";
import { debug } from "@actions/core";
import { ToolchainOverride } from "./toolchain";

export interface ToolchainOptions {
    name: string;
    targets: string[];
    default: boolean;
    override: boolean;
    profile: string;
    components: string[];
}

export function getToolchainArgs(
    override: ToolchainOverride | null
): ToolchainOptions {
    const id = (x: string) => x;
    const split = (x: string) =>
        x
            .split(",")
            .map((s) => s.trim())
            .filter((s) => 0 < s.length);

    if (override?.channel == null && getInput("toolchain") === "") {
        throw new Error(
            "toolchain input was not given and repository does not have a rust-toolchain(.toml)? file"
        );
    }

    return {
        name: select("toolchain", override?.channel, id),
        targets: select("target", override?.targets, split),
        default: getInput("default") === "true",
        override: getInput("override") === "true",
        profile: select("profile", override?.profile, id),
        components: select("components", override?.components, split),
    };
}

function select<T>(
    inputKey: string,
    override: T | undefined,
    map: (x: string) => T
): T {
    const input = getInput(inputKey);
    if (input === "" && override != null) {
        debug(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `${inputKey} is using the value "${override}" from rust-toolchain(.toml)? file`
        );
        return override;
    }

    debug(
        `${inputKey} is using input (specified in GitHub Actions schema) value "${input}"`
    );
    return map(input);
}
