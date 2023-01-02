// based on:
//   - https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file
//   - https://github.com/rust-lang/rustup/blob/5f52d5cf11685fb6a60e70113cfb07b130708529/src/config.rs#L652

import { debug, warning } from "@actions/core";
import fs from "fs";
import path from "path";
import { parse as parseToml } from "toml";
import { z } from "zod";

const toolchainSchema = z.object({
    channel: z.optional(z.string()),
    path: z.optional(z.string()),
    components: z.optional(z.array(z.string())),
    targets: z.optional(z.array(z.string())),
    profile: z.optional(z.string()),
});

export type ToolchainOverride = z.infer<typeof toolchainSchema>;

type ParseMode = "both" | "tomlOnly";

export function tryFindOverrideFile(cwd: string): ToolchainOverride | null {
    const oldFile = tryReadFile(path.join(cwd, "rust-toolchain"));
    const tomlFile = tryReadFile(path.join(cwd, "rust-toolchain.toml"));
    const selected = selectFile(oldFile, tomlFile);
    if (selected == null) {
        return null;
    }

    const [file, parseMode] = selected;
    const content = file.content.trim();
    if (content === "") {
        throw new Error(`config file ${file.path} is empty.`);
    }

    return parse(content, parseMode);
}

type File = {
    path: string;
    content: string;
};

function tryReadFile(path: string): File | null {
    try {
        const content = fs
            .readFileSync(path, { encoding: "utf-8", flag: "r" })
            .toString();
        return { path, content };
    } catch (e) {
        debug(`couldn't read ${path}: ${e as string}`);
        return null;
    }
}

function selectFile(
    oldFile: File | null,
    tomlFile: File | null
): [File, ParseMode] | null {
    if (oldFile == null && tomlFile == null) {
        return null;
    }

    if (oldFile != null && tomlFile != null) {
        warning(
            "both of `rust-toolchain` and `rust-toolchain.toml` found. using `rust-toolchain` file as like rustup does."
        );
        return [oldFile, "both"];
    }

    if (oldFile != null) {
        return [oldFile, "both"];
    }

    if (tomlFile != null) {
        return [tomlFile, "tomlOnly"];
    }

    throw new Error("unreachable");
}

function parse(trimmedContent: string, mode: ParseMode): ToolchainOverride {
    const lines = trimmedContent.split("\n").length;

    if (lines === 1 && mode === "both") {
        return path.isAbsolute(trimmedContent)
            ? { path: trimmedContent }
            : { channel: trimmedContent };
    }

    const parsed = parseToml(trimmedContent) as unknown;
    return z.object({ toolchain: toolchainSchema }).parse(parsed).toolchain;
}
