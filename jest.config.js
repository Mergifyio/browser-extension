module.exports = {
    testEnvironment: "jsdom",
    roots: ["<rootDir>/src"],
    testMatch: ["**/*.test.js"],
    transform: {
        "^.+\\.js$": ["@swc/jest"],
    },
};
