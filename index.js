/**
 * Host half of dsh-approval-reason-dock.
 *
 * The feature lives entirely in the browser half (`./client`). This module
 * only exists so the DSH Loader can mount the bundle row; it registers no
 * tools, services, or model-facing content.
 *
 * Client-side behavior, including the compatibility surface it relies on, is
 * documented in README.md and README.zh.md.
 */

/** Node plugin body: nothing to compose on the Host side. */
export function apply() {}