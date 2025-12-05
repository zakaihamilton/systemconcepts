const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Get the latest commit message
  const commitMessage = execSync('git log -1 --pretty=%B').toString().trim();
  console.error(`Commit message: "${commitMessage}"`); // Use stderr for logs

  let bumpType = 'minor'; // Default fallback

  // Check from highest priority to lowest
  if (commitMessage.includes('BREAKING CHANGE') || commitMessage.includes('!:')) {
    bumpType = 'major';
  } else if (commitMessage.match(/^feat(\(.*\))?:/m)) {
    bumpType = 'minor';
  } else if (commitMessage.match(/^fix(\(.*\))?:/m)) {
    bumpType = 'patch';
  }
  // The default 'minor' applies if none of the above match, or if it matches feat

  // Set output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `BUMP_TYPE=${bumpType}\n`);
  } else {
    console.log(`BUMP_TYPE=${bumpType}`); // Fallback for local testing
  }
} catch (error) {
  console.error('Error determining version bump:', error);
  process.exit(1);
}
