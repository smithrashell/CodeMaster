/**
 * Background Script Test Functions
 * These functions are only loaded in development mode
 * Production builds exclude this entire file via webpack configuration
 */

// Import all test utilities and scenarios
import { TestScenarios } from '../shared/utils/testing/quickTest.js';
import { ComprehensiveTestScenarios } from '../shared/utils/comprehensiveSessionTesting.js';
import { MinimalSessionTester } from '../shared/utils/minimalSessionTesting.js';
import { SilentSessionTester } from '../shared/utils/silentSessionTesting.js';
import { TagProblemIntegrationTester } from '../shared/utils/integrationTesting.js';
import { DynamicPathOptimizationTester } from '../shared/utils/testing/testDataIsolation.js';
import { RealSystemTester } from '../shared/utils/realSystemTesting.js';
import { RelationshipSystemTester } from '../shared/utils/relationshipSystemTesting.js';

export function initializeTestFunctions() {
  console.log('🧪 Initializing development test functions...');

  // Quick test functions
  globalThis.testQuick = () => TestScenarios.quickTest().runSimulation();
  globalThis.testOnboarding = () => TestScenarios.onboarding().runSimulation();
  globalThis.testProgression = () => TestScenarios.difficultyProgression().runSimulation();
  globalThis.testStruggling = () => TestScenarios.strugglingUser().runSimulation();

  // Comprehensive test functions
  globalThis.testComprehensive = () => ComprehensiveTestScenarios.fullValidation().runComprehensiveTests();
  globalThis.testQuickComprehensive = () => ComprehensiveTestScenarios.quickComprehensive().runComprehensiveTests();
  globalThis.testAdaptation = () => ComprehensiveTestScenarios.adaptationFocus().runComprehensiveTests();

  // Minimal and silent testing
  globalThis.testMinimal = (options = {}) => new MinimalSessionTester().testSessionLengthAdaptation(options);
  globalThis.testSilent = (options) => new SilentSessionTester().testSessionConsistency(options);

  // Integration tests
  globalThis.testTagIntegration = (options) => {
    return TagProblemIntegrationTester.runAllIntegrationTests({ quiet: false, ...options });
  };
  globalThis.testTagLadderPathfinding = (options) => TagProblemIntegrationTester.testTagLadderPathfindingIntegration({ quiet: false, ...options });
  globalThis.testSessionBlending = (options) => TagProblemIntegrationTester.testAdaptiveSessionIntegration({ quiet: false, ...options });
  globalThis.testLearningJourney = (options) => TagProblemIntegrationTester.testLearningJourneyOptimization({ quiet: false, ...options });
  globalThis.testAllIntegration = (options) => TagProblemIntegrationTester.runAllIntegrationTests({ quiet: false, ...options });

  // Optimization tests
  globalThis.testPathOptimization = (options) => DynamicPathOptimizationTester.testOptimalProblemSelection({ quiet: false, ...options });
  globalThis.testProblemSelection = (options) => DynamicPathOptimizationTester.testOptimalProblemSelection({ quiet: false, ...options });
  globalThis.testPatternLearning = (options) => DynamicPathOptimizationTester.testSuccessPatternLearning({ quiet: false, ...options });
  globalThis.testPlateauRecovery = (options) => DynamicPathOptimizationTester.testPlateauDetectionRecovery({ quiet: false, ...options });
  globalThis.testMultiSessionPaths = (options) => DynamicPathOptimizationTester.testMultiSessionOptimization({ quiet: false, ...options });
  globalThis.testAllOptimization = (options) => DynamicPathOptimizationTester.runAllOptimizationTests({ quiet: false, ...options });

  // Real system tests
  globalThis.testRealLearningFlow = (options) => RealSystemTester.testRealLearningFlow({ quiet: false, ...options });
  globalThis.testRealFocusCoordination = (options) => RealSystemTester.testRealFocusCoordination({ quiet: false, ...options });
  globalThis.testRealSessionCreation = (options) => RealSystemTester.testRealSessionCreation({ quiet: false, ...options });
  globalThis.testRealRelationshipLearning = (options) => RealSystemTester.testRealRelationshipLearning({ quiet: false, ...options });
  globalThis.testAllRealSystem = (options) => RealSystemTester.runAllRealSystemTests({ quiet: false, ...options });

  // Relationship system tests
  globalThis.testRelationshipFlow = (options) => RelationshipSystemTester.testRelationshipDataFlow({ quiet: false, ...options });
  globalThis.testRelationshipComposition = (options) => RelationshipSystemTester.testRelationshipSessionComposition({ quiet: false, ...options });
  globalThis.testRelationshipUpdates = (options) => RelationshipSystemTester.testRelationshipUpdates({ quiet: false, ...options });
  globalThis.testFocusRelationships = (options) => RelationshipSystemTester.testFocusRelationshipIntegration({ quiet: false, ...options });
  globalThis.testRelationshipConsistency = (options) => RelationshipSystemTester.testRelationshipLearningConsistency({ quiet: false, ...options });
  globalThis.testAllRelationships = (options) => RelationshipSystemTester.runAllRelationshipTests({ quiet: false, ...options });

  console.log('✅ Development test functions initialized');
}