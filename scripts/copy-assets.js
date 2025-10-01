const fs = require("fs");
const path = require("path");

function copyFolder(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });

  for (const item of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolder(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ Copied: ${srcPath} -> ${destPath}`);
    }
  }
}

// Copy everything from src/renderer → dist/renderer
copyFolder(
  path.join(__dirname, "../src/renderer"),
  path.join(__dirname, "../dist/renderer")
);

// Copy global assets (icons, app icon, etc.)
copyFolder(
  path.join(__dirname, "../assets"),
  path.join(__dirname, "../dist/assets")
);
