import { describe, expect, it } from "vitest";

import { getToolchainArgs } from "../src/args";
import { tryFindOverrideFile } from "../src/toolchain";
import { morph } from "mock-env";
import tempWrite from "temp-write";
import path from "path";

describe("actions-rs/toolchain", () => {
    it("Parses action input into toolchain options", () => {
        const args = morph(
            () => {
                return getToolchainArgs(null);
            },
            {
                INPUT_TOOLCHAIN: "nightly-2019-04-20",
                INPUT_DEFAULT: "false",
                INPUT_OVERRIDE: "true",
            }
        );

        expect(args.name).toBe("nightly-2019-04-20");
        expect(args.default).toBe(false);
        expect(args.override).toBe(true);
    });

    it("uses input variable if rust-toolchain file does not exist", function () {
        const args = morph(
            () => {
                return getToolchainArgs(null);
            },
            {
                INPUT_TOOLCHAIN: "nightly",
            }
        );

        expect(args.name).toBe("nightly");
    });

    it("toolchain input is required if rust-toolchain does not exist", function () {
        expect(() => getToolchainArgs(null)).toThrowError();
    });

    it("prioritizes rust-toolchain file over input variable", function () {
        const rustToolchainFile = tempWrite.sync("1.39.0", "rust-toolchain");

        const args = morph(
            () => {
                return getToolchainArgs(
                    tryFindOverrideFile(path.dirname(rustToolchainFile))
                );
            },
            {
                INPUT_TOOLCHAIN: "nightly",
            }
        );

        expect(args.name).toBe("nightly");
    });

    it("uses rust-toolchain file if input does not exist", function () {
        const rustToolchainFile = tempWrite.sync("1.39.0", "rust-toolchain");

        const args = morph(() => {
            return getToolchainArgs(
                tryFindOverrideFile(path.dirname(rustToolchainFile))
            );
        }, {});

        expect(args.name).toBe("1.39.0");
    });

    it("trims content of the override file", function () {
        const rustToolchainFile = tempWrite.sync(
            "     1.39.0               ",
            "rust-toolchain"
        );

        const args = morph(() => {
            return getToolchainArgs(
                tryFindOverrideFile(path.dirname(rustToolchainFile))
            );
        }, {});

        expect(args.name).toBe("1.39.0");
    });

    it("parses rust-toolchain file as toml file", function () {
        const rustToolchainFile = tempWrite.sync(
            "[toolchain]\nchannel='1.63.0'\ncomponents=['rustfmt', 'clippy']\n",
            "rust-toolchain"
        );

        const args = morph(() => {
            return getToolchainArgs(
                tryFindOverrideFile(path.dirname(rustToolchainFile))
            );
        }, {});

        expect(args.name).toBe("1.63.0");
        expect(args.components.sort()).toEqual(["rustfmt", "clippy"].sort());
    });

    it("parses rust-toolchain.toml file as toml file", function () {
        const rustToolchainFile = tempWrite.sync(
            "[toolchain]\nchannel='nightly'\n",
            "rust-toolchain.toml"
        );

        const args = morph(() => {
            return getToolchainArgs(
                tryFindOverrideFile(path.dirname(rustToolchainFile))
            );
        }, {});

        expect(args.name).toBe("nightly");
    });

    it("doesn't parses rust-toolchain.toml file as old file", function () {
        const rustToolchainFile = tempWrite.sync(
            "nightly",
            "rust-toolchain.toml"
        );

        expect(() =>
            morph(() => {
                return getToolchainArgs(
                    tryFindOverrideFile(path.dirname(rustToolchainFile))
                );
            }, {})
        ).toThrowError();
    });
});
