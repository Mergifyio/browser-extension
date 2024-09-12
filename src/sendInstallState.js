function sendInstallState() {
    window.postMessage({
        mergifyExtensionVariant: "unknown-browser",
        // For backward compatibility
        isMergifyChromeExtensionInstalled: true,
    }, '*');
}

(function() {
    'use strict';

    const observer = new MutationObserver(() => {
        if (location.href.includes('integrations')) {
            sendInstallState();
        }
    });

    const config = { subtree: true, childList: true };
    observer.observe(document.body, config);
}());
