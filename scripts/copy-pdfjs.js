const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'node_modules', 'pdfjs-dist', 'build');
const destDir = path.join(root, 'assets', 'pdfjs');

const files = [
  { src: 'pdf.min.js', dest: 'pdf.min.js' },
  { src: 'pdf.worker.min.js', dest: 'pdf.worker.min.js' },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-pdfjs] Missing source: ${src}`);
    return;
  }
  fs.copyFileSync(src, dest);
  console.log(`[copy-pdfjs] Copied ${path.basename(src)} -> ${dest}`);
}

ensureDir(destDir);

files.forEach((f) => {
  const src = path.join(srcDir, f.src);
  const dest = path.join(destDir, f.dest);
  copyFile(src, dest);
});
