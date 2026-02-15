const { join } = require('node:path');
const { notarize } = require('@electron/notarize');

const REQUIRED_ENV_KEYS = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
const RELEASE_GUIDE_PATH = 'docs/release.md';

function hasNotarizeEnv() {
  return REQUIRED_ENV_KEYS.every((key) => Boolean(process.env[key]));
}

function releaseMode() {
  return (process.env.RELEASE_MODE || 'unsigned').toLowerCase();
}

exports.default = async function notarizeApp(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const mode = releaseMode();
  const strictSignedMode = mode === 'signed';

  if (!hasNotarizeEnv()) {
    if (strictSignedMode) {
      throw new Error(
        '[notarize] signed mode requires APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID'
      );
    }

    process.stderr.write(
      `[notarize] skipped (missing APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID, mode=${mode})\n`
    );
    process.stderr.write(
      `[notarize] continuing as unsigned build. Gatekeeper override is required on first launch. See ${RELEASE_GUIDE_PATH}\n`
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = join(context.appOutDir, `${appName}.app`);

  try {
    await notarize({
      tool: 'notarytool',
      appBundleId: 'com.tanabe1478.agentplans',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
    process.stderr.write('[notarize] notarization completed successfully\n');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[notarize] failed: ${detail}\n`);
    if (strictSignedMode) {
      throw error;
    }
    process.stderr.write(
      `[notarize] continuing because mode=${mode}. This build should be treated as unsigned. See ${RELEASE_GUIDE_PATH}\n`
    );
  }
};
