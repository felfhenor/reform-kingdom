const path = require('path');
const fs = require('fs');

const isDemo = process.env.REFORM_DEMO === '1';
const appName = isDemo ? 'reformkingdom-demo' : 'reformkingdom';

module.exports = {
  outDir: isDemo ? 'out-demo' : 'out',
  packagerConfig: {
    executableName: appName,
    appBundleId: `com.felfhenor.${appName}`,
    appCopyright: 're:Form Kingdom Team',
    appCategoryType: 'public.app-category.games',
    icon: './icons/icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: appName,
        icon: './icons/icon.ico',
        setupIcon: './icons/icon.ico',
        setupExe: `${appName}.exe`,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: './icons/icon.icns',
        setupIcon: './icons/icon.icns',
      },
    },
  ],
  hooks: {
    // Renaming only the packaged copy gives the demo its own userData (saves), instance lock and install dir.
    packageAfterCopy: async (config, buildPath) => {
      if (!isDemo) return;

      const packageJsonPath = path.join(buildPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageJson.name = appName;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    },
    postMake: (config, makeResults) => {
      return makeResults;
    },
  },
};
