/**
 * Quick Mock Service Test
 * Simple test to verify mock services work without errors
 */

// Import the factory and config
import { getSessionService, isUsingMockServices } from '../../services/session/sessionServiceFactory.js';
import { shouldUseMockSession } from '../../../app/config/mockConfig.js';

/**
 * Simple test function to verify mock services are working
 */
export async function testMockServices() {
  console.log('🧪 Testing Mock Services...');

  try {
    // Check configuration
    const shouldUseMock = shouldUseMockSession();
    console.log('📋 Should use mock services:', shouldUseMock);

    // Check service detection
    const usingMocks = await isUsingMockServices();
    console.log('🎭 Currently using mock services:', usingMocks);

    // Test service creation
    const sessionService = await getSessionService();
    console.log('✅ Session service created:', sessionService._isMock ? 'Mock' : 'Real');

    // Test basic functionality
    const session = await sessionService.getOrCreateSession('standard');
    console.log('🎯 Session created:', session.id, 'with', session.problems?.length || 0, 'problems');

    console.log('✅ Mock services test completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Mock services test failed:', error);
    return false;
  }
}

// Make function available in browser console for testing
if (typeof window !== 'undefined') {
  window.testMockServices = testMockServices;
}