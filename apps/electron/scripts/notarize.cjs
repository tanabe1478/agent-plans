const { join } = require('node:path');
const { notarize } = require('@electron/notarize');

const REQUIRED_ENV_KEYS = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];

function hasNotarizeEnv() {
  return REQUIRED_ENV_KEYS.every((key) => Boolean(process.env[key]));
}

exports.default = async function notarizeApp(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  if (!hasNotarizeEnv()) {
    process.stderr.write(
      '[notarize] skipped (APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set)\n'
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = join(context.appOutDir, `${appName}.app`);

  await notarize({
    tool: 'notarytool',
    appBundleId: 'com.tanabe1478.agentplans',
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
