/**
 * Testing utilities barrel export
 */
export { TestDataIsolation, default as testDataIsolation } from './testDataIsolation.js';
export { QuickTestRunner } from './quickTest.js';
export { testMockServices } from './quickMockTest.js';
export { installDatabaseDebugger } from './DatabaseDebugger.js';
export { testProgression } from './progressionTest.js';
export {
  testNormalPromotion,
  testFullPromotionChain,
  testEscapeHatchPromotion,
  testDemotionHardToMedium,
  testFullDemotionChain,
  testNoDemotionWithTwoLowSessions,
  testCannotDemoteFromEasy,
  testEscapeHatchesResetAfterDemotion,
  runAllBidirectionalTests
} from './bidirectionalDifficultyTest.js';
