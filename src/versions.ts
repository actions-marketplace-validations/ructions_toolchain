import { exec, ExecOptions } from "@actions/exec";
import { endGroup, setOutput, startGroup, warning } from "@actions/core";

interface Version {
    long: string;
    hash: string;
}

const fullRegex = /\S+\s((\S+)\s\((\S+)\s(\S+)\))/m;
const shortRegex = /\S+\s(.+)/m;

/**
 * Try to parse the version parts and return them.
 *
 * It is important to note that some components are not providing
 * all the expected information, ex. `rustup` on `macOS-latest` VM image
 * does not has the hash in the version string,
 * so this function might throw an error.
 *
 * As a fallback, `parseShort` function can be used.
 */
function parseFull(stdout: string): Version {
    const trimmed = stdout.trim();
    const matches = fullRegex.exec(trimmed);
    if (matches == null) {
        throw new Error(`Unable to parse version from the "${trimmed}" string`);
    }

    return {
        long: matches[1],
        hash: matches[3],
    };
}

function parseShort(stdout: string): string {
    const trimmed = stdout.trim();
    const matches = shortRegex.exec(trimmed);
    if (matches == null) {
        warning(`Unable to determine version from the "${trimmed}" string`);
        return "";
    } else {
        return matches[1];
    }
}

async function getStdout(
    exe: string,
    args: string[],
    options?: ExecOptions
): Promise<string> {
    let stdout = "";
    const resOptions = {
        ...options,
        listeners: {
            stdout: (buffer: Buffer): void => {
                stdout += buffer.toString();
            },
        },
    };

    await exec(exe, args, resOptions);

    return stdout;
}

/**
 * Fetch currently used `rustc` version
 */
async function rustc(): Promise<void> {
    const stdout = await getStdout("rustc", ["-V"]);
    try {
        const version = parseFull(stdout);

        setOutput("rustc", version.long);
        setOutput("rustc_hash", version.hash);
    } catch (e) {
        warning(e as Error);
        setOutput("rustc", parseShort(stdout));
    }
}

/**
 * Fetch currently used `cargo` version
 */
async function cargo(): Promise<void> {
    const stdout = await getStdout("cargo", ["-V"]);
    try {
        const version = parseFull(stdout);

        setOutput("cargo", version.long);
    } catch (e) {
        setOutput("cargo", parseShort(stdout));
    }
}

async function rustup(): Promise<void> {
    const stdout = await getStdout("rustup", ["-V"]);
    try {
        const version = parseFull(stdout);
        setOutput("rustup", version.long);
    } catch (e) {
        setOutput("rustup", parseShort(stdout));
    }
}

export async function gatherInstalledVersions(): Promise<void> {
    try {
        startGroup("Gathering installed versions");

        await rustc();
        await cargo();
        await rustup();
    } finally {
        endGroup();
    }
}
