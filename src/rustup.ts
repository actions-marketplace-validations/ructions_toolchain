import { addPath, debug, info } from "@actions/core";
import type { ToolchainOptions } from "./args";
import { compare } from "compare-versions";
import { downloadTool } from "@actions/tool-cache";
import { exec, ExecOptions } from "@actions/exec";
import { promises as fs } from "fs";
import { join } from "path";
import process from "process";
import { which } from "@actions/io";

const PROFILES_MIN_VERSION = "1.20.1";
const COMPONENTS_MIN_VERSION = "1.20.1";

export async function getOrInstall(): Promise<RustUp> {
    try {
        return await get();
    } catch (error) {
        debug(
            `Unable to find "rustup" executable, installing it now. Reason: ${(
                error as Error
            ).toString()}`
        );
        return install();
    }
}

// Will throw an error if `rustup` is not installed.
export async function get(): Promise<RustUp> {
    const exePath = await which("rustup", true);

    return new RustUp(exePath);
}

export async function install(): Promise<RustUp> {
    const args = [
        "--default-toolchain",
        "none",
        "-y", // No need for the prompts (hard error from within the Docker containers)
    ];

    switch (process.platform) {
        case "darwin":
        case "linux": {
            // eslint-disable-line prettier/prettier
            const rustupSh = await downloadTool("https://sh.rustup.rs");

            // While the `rustup-init.sh` is properly executed as is,
            // when Action is running on the VM itself,
            // it fails with `EACCES` when called in the Docker container.
            // Adding the execution bit manually just in case.
            // See: https://github.com/actions-rs/toolchain/pull/19#issuecomment-543358693
            debug(`Executing chmod 755 on the ${rustupSh}`);
            await fs.chmod(rustupSh, 0o755);

            await exec(rustupSh, args);
            break;
        }

        case "win32": {
            const rustupExe = await downloadTool("https://win.rustup.rs");
            await exec(rustupExe, args);
            break;
        }

        default:
            throw new Error(
                `Unknown platform ${process.platform}, can't install rustup`
            );
    }

    // `$HOME` should always be declared, so it is more to get the linters happy
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    addPath(join(process.env.HOME!, ".cargo", "bin"));

    // Assuming it is in the $PATH already
    return new RustUp("rustup");
}

export class RustUp {
    constructor(private readonly path: string) {}

    public async installToolchain(
        name: string,
        noSelfUpdate: boolean,
        allowDowngrade: boolean,
        options?: Partial<ToolchainOptions>
    ): Promise<number> {
        const args = this.buildArgs(
            name,
            noSelfUpdate,
            allowDowngrade,
            options
        );

        await this.call(args);

        if (options && options.default) {
            await this.call(["default", name]);
        }

        if (options && options.override) {
            await this.call(["override", "set", name]);
        }

        // TODO: Is there something like Rust's `Ok(())`?
        return 0;
    }

    private buildArgs(
        name: string,
        noSelfUpdate: boolean,
        allowDowngrade: boolean,
        options?: Partial<ToolchainOptions>
    ) {
        const args = ["toolchain", "install", name];

        if (options && options.components && options.components.length > 0) {
            for (const component of options.components) {
                args.push("--component");
                args.push(component);
            }
        }
        if (noSelfUpdate) {
            args.push("--no-self-update");
        }

        if (allowDowngrade) {
            args.push("--allow-downgrade");
        }
        return args;
    }

    public addTarget(name: string, forToolchain?: string): Promise<number> {
        const args = ["target", "add"];
        if (forToolchain) {
            args.push("--toolchain");
            args.push(forToolchain);
        }
        args.push(name);

        return this.call(args);
    }

    public async activeToolchain(): Promise<string> {
        const stdout = await this.callStdout(["show", "active-toolchain"]);

        if (stdout) {
            return stdout.split(" ", 2)[0];
        }
        throw new Error("Unable to determine active toolchain");
    }

    public async supportProfiles(): Promise<boolean> {
        const version = await this.version();
        const supports = compare(version, PROFILES_MIN_VERSION, ">=");
        if (supports) {
            info(`Installed rustup ${version} support profiles`);
        } else {
            info(`Installed rustup ${version} does not support profiles, \
expected at least ${PROFILES_MIN_VERSION}`);
        }
        return supports;
    }

    public async supportComponents(): Promise<boolean> {
        const version = await this.version();
        const supports = compare(version, COMPONENTS_MIN_VERSION, ">=");
        if (supports) {
            info(`Installed rustup ${version} support components`);
        } else {
            info(`Installed rustup ${version} does not support components, \
expected at least ${PROFILES_MIN_VERSION}`);
        }
        return supports;
    }

    /**
     * Executes `rustup set profile ${name}`
     *
     * Note that it includes the check if currently installed rustup support profiles at all
     */
    public async setProfile(name: string): Promise<number> {
        return await this.call(["set", "profile", name]);
    }

    public async version(): Promise<string> {
        const stdout = await this.callStdout(["-V"]);

        return stdout.split(" ")[1];
    }

    // rustup which `program`
    public async which(program: string): Promise<string> {
        const stdout = await this.callStdout(["which", program]);

        if (stdout) {
            return stdout;
        } else {
            throw new Error(`Unable to find the ${program}`);
        }
    }

    public async selfUpdate(): Promise<number> {
        return await this.call(["self", "update"]);
    }

    public async call(args: string[], options?: ExecOptions): Promise<number> {
        return await exec(this.path, args, options);
    }

    /**
     * Call the `rustup` and return an stdout
     */
    async callStdout(args: string[], options?: ExecOptions): Promise<string> {
        let stdout = "";
        const resOptions = {
            ...options,
            listeners: {
                stdout: (buffer: Buffer): void => {
                    stdout += buffer.toString();
                },
            },
        };

        await this.call(args, resOptions);

        return stdout;
    }
}
