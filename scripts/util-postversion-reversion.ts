import { promisify } from 'util';
import child from 'child_process';
import packageJson from '../package.json';

const exec = promisify(child.exec);

const version = packageJson.version;

async function rewriteVersion() {
  await exec(`git tag -d v${version}`);
  await exec(`git tag v${version}`);
}

rewriteVersion();

console.info(
  `Rewrote version to be post-changelog commit instead of pre-changelog commit.`,
);
