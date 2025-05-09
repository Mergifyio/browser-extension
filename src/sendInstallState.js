function sendInstallState() {
    window.postMessage(
        {
            mergifyExtensionVariant: "unknown-browser",
            // For backward compatibility
            isMergifyChromeExtensionInstalled: true,
        },
        // This is very important security thing, otherwise we leak the installation
        // of Mergify extension to any site.
        "https://dashboard.mergify.com",
    );
}

(() => {
    const observer = new MutationObserver(() => {
        if (location.href.includes("integrations")) {
            sendInstallState();
        }
    });

    const config = { subtree: true, childList: true };
    observer.observe(document.body, config);
})();
