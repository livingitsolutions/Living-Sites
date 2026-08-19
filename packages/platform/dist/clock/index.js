/**
 * Clock module — time abstraction for deterministic, testable time.
 *
 * Contracts and platform implementations. Domain and Application receive
 * Clock via injection; they never call Date.now() directly.
 */
export { SystemClock } from "./system-clock.js";
export { FakeClock } from "./fake-clock.js";
//# sourceMappingURL=index.js.map