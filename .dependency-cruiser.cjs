/**
 * M-002 · Root dependency-cruiser entry point.
 *
 * Owns NO rules. The rule set lives in packages/config so it is versioned with everything else
 * the workspace shares — a second copy here is how the two drift and the enforced architecture
 * stops matching the documented one.
 */
'use strict';
module.exports = require('./packages/config/dependency-cruiser/index.cjs');
