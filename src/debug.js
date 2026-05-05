window.__MERGIFY_DEBUG__ ??= false;

export function debug(...args) {
    if (!window.__MERGIFY_DEBUG__) return;
    console.log(...args);
}
