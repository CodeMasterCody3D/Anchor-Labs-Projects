const path = require('path');

/**
 * Resolves a server module reliably regardless of whether hooks are executed
 * from the git repository checkout, runtime directory ~/.project-anchor,
 * or installed under ~/.claude/skills/project-anchor.
 */
function resolveServer(moduleName) {
  const homeDir = process.env.HOME || '/home/cody';
  const candidates = [
    path.join(__dirname, '../../server', moduleName),
    path.join(__dirname, '../server', moduleName),
    path.join(homeDir, '.project-anchor/server', moduleName),
    path.join(homeDir, 'Anchor-Labs-Projects/server', moduleName)
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND' && !err.message.includes('Cannot find module')) {
        throw err;
      }
    }
  }

  // Graceful fallback dummy if completely missing
  return null;
}

module.exports = resolveServer;
