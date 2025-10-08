/**
 * Test helpers for SessionService critical tests
 */

/**
 * Creates mock problems for testing
 */
export function createMockProblems(count = 2) {
  const problems = [];
  for (let i = 1; i <= count; i++) {
    problems.push({
      id: i,
      leetcode_id: i,
      title: `Problem ${i}`,
      difficulty: i % 3 === 0 ? 'Hard' : i % 2 === 0 ? 'Medium' : 'Easy'
    });
  }
  return problems;
}

/**
 * Sets up basic session creation mocks
 */
export function setupSessionCreationMocks(
  ProblemService,
  getLatestSessionByType,
  saveNewSessionToDB,
  saveSessionToStorage,
  problems = null
) {
  ProblemService.createSession.mockResolvedValue(problems || createMockProblems(2));
  getLatestSessionByType.mockResolvedValue(null);
  saveNewSessionToDB.mockResolvedValue();
  saveSessionToStorage.mockResolvedValue();
}

/**
 * Sets up interview session mocks
 */
export function setupInterviewSessionMocks(
  ProblemService,
  getLatestSessionByType,
  saveNewSessionToDB,
  saveSessionToStorage,
  problems = null
) {
  ProblemService.createInterviewSession.mockResolvedValue(problems || createMockProblems(3));
  getLatestSessionByType.mockResolvedValue(null);
  saveNewSessionToDB.mockResolvedValue();
  saveSessionToStorage.mockResolvedValue();
}

/**
 * Creates a mock existing session
 */
export function createMockSession(overrides = {}) {
  return {
    id: 1,
    session_type: 'standard',
    status: 'draft',
    problems: createMockProblems(2),
    num_sessions_completed: 0,
    current_streak: 0,
    ...overrides
  };
}

/**
 * Asserts session is valid
 */
export function assertValidSession(session, expectedType = 'standard', expectedStatus = 'draft') {
  expect(session).not.toBeNull();
  expect(session.problems).toBeDefined();
  expect(session.problems.length).toBeGreaterThan(0);
  expect(session.status).toBe(expectedStatus);
  expect(session.session_type).toBe(expectedType);
}

/**
 * Asserts session progress is preserved
 */
export function assertProgressPreserved(session, originalSession) {
  expect(session.num_sessions_completed).toBe(originalSession.num_sessions_completed);
  expect(session.current_streak).toBe(originalSession.current_streak);
}
