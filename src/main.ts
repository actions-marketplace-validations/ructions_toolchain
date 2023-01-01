import { endGroup, setFailed, startGroup } from "@actions/core";
import { gatherInstalledVersions } from "./versions";
import { getOrInstall, RustUp } from "./rustup";
import { getToolchainArgs, ToolchainOptions } from "./args";
import { join } from "path";

async function selfUpdate(installOptions: ToolchainOptions, rustup: RustUp) {
    let neededSelfUpdate = false;
    if (installOptions.profile && !(await rustup.supportProfiles())) {
        neededSelfUpdate = true;
    }
    if (installOptions.components && !(await rustup.supportComponents())) {
        neededSelfUpdate = true;
    }
    if (neededSelfUpdate) {
        startGroup("Updating rustup");
        try {
            await rustup.selfUpdate();
        } finally {
            endGroup();
        }
    }
    return neededSelfUpdate;
}

async function run(): Promise<void> {
    const toolchainOverridePath = join(process.cwd(), "rust-toolchain");

    const installOptions = getToolchainArgs(toolchainOverridePath);
    const rustup = await getOrInstall();
    await rustup.call(["show"]);

    const didSelfUpdate = await selfUpdate(installOptions, rustup);

    if (installOptions.profile) {
        await rustup.setProfile(installOptions.profile);
    }

    // Extra funny case.
    // Due to `rustup` issue (https://github.com/rust-lang/rustup/issues/2146)
    // right now installing `nightly` toolchain with extra components might fail
    // if that specific `nightly` version does not have this component
    // available.
    //
    // See https://github.com/actions-rs/toolchain/issues/53 also.
    //
    // By default `rustup` does not downgrade, as it does when you are
    // updating already installed `nightly`, so we need to pass the
    // corresponding flag manually.
    //
    // We are doing it only if both following conditions apply:
    //
    //   1. Requested toolchain is `"nightly"` (exact string match).
    //   2. At least one component is requested.
    //
    // All other cases are not triggering automatic downgrade,
    // for example, installing specific nightly version
    // as in `"nightly-2020-03-20"` or `"stable"`.
    //
    // Motivation is that users probably want the latest one nightly
    // with rustfmt and clippy (miri, etc) and they don't really care
    // about what exact nightly it is.
    // In case if it's not the nightly at all or it is a some specific
    // nightly version, they know what they are doing.
    const allowDowngrade =
        !!(installOptions.name == "nightly") && !!installOptions.components;

    // We already did it just now, there is no reason to do that again,
    // so it would skip few network calls.
    await rustup.installToolchain(
        installOptions.name,
        !didSelfUpdate,
        allowDowngrade,
        installOptions
    );

    if (installOptions.targets) {
        for (const target of installOptions.targets) {
            await rustup.addTarget(target, installOptions.name);
        }
    }

    await gatherInstalledVersions();
}

async function main(): Promise<void> {
    try {
        await run();
    } catch (error) {
        setFailed((error as Error).message);
    }
}

void main();
