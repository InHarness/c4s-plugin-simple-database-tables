/**
 * Backend ENTRY — imported by the host loader (`await import("__plugin_name__")`).
 *
 * Exports the manifest both as DEFAULT and as a named `manifest` export (the loader
 * accepts either: `mod.manifest ?? mod.default`).
 */

import manifest from './manifest';

export { manifest };
export default manifest;
