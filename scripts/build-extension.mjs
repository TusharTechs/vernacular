// Copies the shared in-page script into the extension folder, so the extension
// and the /anywhere demo always run the same code. Usage: npm run build:extension
import { copyFileSync } from "node:fs";
copyFileSync("public/anywhere/vernacular-anywhere.js", "extension/vernacular-anywhere.js");
console.log("extension/ is ready: load it unpacked from chrome://extensions");
