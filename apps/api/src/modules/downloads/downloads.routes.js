import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to desktop distribution folder
const DESKTOP_DIST_DIR = path.resolve(__dirname, '../../../../desktop/dist');
const WIN_UNPACKED_EXE = path.join(DESKTOP_DIST_DIR, 'win-unpacked', 'OwlSync.exe');

/**
 * Helper to find files matching a pattern in desktop dist
 */
function findDistFile(predicate) {
  if (!fs.existsSync(DESKTOP_DIST_DIR)) return null;
  const files = fs.readdirSync(DESKTOP_DIST_DIR);
  const matched = files.find(predicate);
  return matched ? path.join(DESKTOP_DIST_DIR, matched) : null;
}

// Check availability of downloadable binaries
router.get('/status', (req, res) => {
  const windowsInstaller = findDistFile(f => f.endsWith('.exe') && !f.includes('portable'));
  const windowsPortableZip = findDistFile(f => f.endsWith('.zip') && f.includes('Portable'));
  const hasUnpackedExe = fs.existsSync(WIN_UNPACKED_EXE);

  const available = !!(windowsInstaller || windowsPortableZip || hasUnpackedExe);

  res.json({
    windows: {
      available,
      fileName: windowsInstaller 
        ? path.basename(windowsInstaller) 
        : windowsPortableZip 
          ? path.basename(windowsPortableZip) 
          : hasUnpackedExe 
            ? 'OwlSync.exe' 
            : null,
      downloadUrl: '/api/download/windows',
    },
    portable: {
      available: !!windowsPortableZip || hasUnpackedExe,
      fileName: windowsPortableZip ? path.basename(windowsPortableZip) : (hasUnpackedExe ? 'OwlSync.exe' : null),
      downloadUrl: '/api/download/portable',
    },
    githubReleasesUrl: 'https://github.com/DhruvGola777/OwlSync/releases',
  });
});

// Download Windows package
router.get('/windows', (req, res) => {
  // 1. First priority: Installer .exe
  const installerPath = findDistFile(f => f.endsWith('.exe') && !f.includes('portable'));
  if (installerPath && fs.existsSync(installerPath)) {
    return res.download(installerPath, path.basename(installerPath));
  }

  // 2. Second priority: Portable Zip (contains full Electron app)
  const portableZip = findDistFile(f => f.endsWith('.zip'));
  if (portableZip && fs.existsSync(portableZip)) {
    return res.download(portableZip, path.basename(portableZip));
  }

  // 3. Third priority: win-unpacked/OwlSync.exe
  if (fs.existsSync(WIN_UNPACKED_EXE)) {
    return res.download(WIN_UNPACKED_EXE, 'OwlSync.exe');
  }

  // 4. Fallback to direct GitHub release binary download
  return res.redirect('https://github.com/DhruvGola777/OwlSync/releases/latest/download/OwlSync-Setup-1.0.0.exe');
});

// Download Windows portable (.zip or .exe)
router.get('/portable', (req, res) => {
  const portableZip = findDistFile(f => f.endsWith('.zip') && f.includes('Portable'))
    || findDistFile(f => f.endsWith('.zip'));

  if (portableZip && fs.existsSync(portableZip)) {
    return res.download(portableZip, path.basename(portableZip));
  }

  if (fs.existsSync(WIN_UNPACKED_EXE)) {
    return res.download(WIN_UNPACKED_EXE, 'OwlSync.exe');
  }

  return res.redirect('https://github.com/DhruvGola777/OwlSync/releases');
});

// Fallback for mac / linux / general
router.get('/:platform', (req, res) => {
  const { platform } = req.params;
  const extMap = {
    mac: ['.dmg', '.zip'],
    linux: ['.AppImage', '.deb'],
  };

  const allowedExts = extMap[platform] || [];
  const distFile = findDistFile(f => allowedExts.some(ext => f.endsWith(ext)));

  if (distFile && fs.existsSync(distFile)) {
    return res.download(distFile, path.basename(distFile));
  }

  return res.redirect('https://github.com/DhruvGola777/OwlSync/releases');
});

export default router;
