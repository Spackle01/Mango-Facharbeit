'use strict';
// macOS: Die App ist nicht mit einem Apple-Entwicklerzertifikat signiert. Damit sie auf Macs mit
// Apple-Chip überhaupt startet, bekommt sie eine „Ad-hoc“-Signatur (ohne Zertifikat).
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  console.log(`Ad-hoc signiert: ${app}`);
};
