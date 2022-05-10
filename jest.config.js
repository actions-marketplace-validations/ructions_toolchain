const config = {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    rootDir: "__tests__",
    verbose: true,
    globals: {
        "ts-jest": {
            useESM: true,
        },
    },
};

export default config;
