declare module "mock-env" {
    export function morph<T>(
        callback: () => T,
        vars?: Record<string, string>,
        toRemove?: readonly string[]
    ): T;
}
