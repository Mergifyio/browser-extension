const fs = require("node:fs");
const path = require("node:path");

function loadFixture(name) {
    const htmlPath = path.resolve(__dirname, `./fixtures/${name}.html`);
    const htmlContent = fs.readFileSync(htmlPath, "utf8");

    document.body.innerHTML = htmlContent;
}

module.exports = {
    loadFixture,
};
