"""
Fix require-await warnings by removing async keyword from functions without await.
"""
import re

def fix_require_await_in_file(filename):
    """Remove async from functions that don't use await."""
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match async function exports that don't contain await
    # We'll be conservative and only fix the handlers we know about
    handlers_to_fix = [
        # Problem handlers
        'handleGetProblemByDescription',
        'handleCountProblemsByBoxLevel',
        'handleAddProblem',
        'handleProblemSubmitted',
        'handleSkipProblem',
        'handleGetAllProblems',
        'handleGetProblemById',
        'handleGetProblemAttemptStats',
        # Session handlers
        'handleGetSession',
        'handleRefreshSession',
        'handleGetCurrentSession',
        'handleManualSessionCleanup',
        'handleGetSessionAnalytics',
        'handleClassifyAllSessions',
        'handleGenerateSessionFromTracking',
        'handleGetSessionMetrics',
        'handleCheckInterviewFrequency',
        'handleCompleteInterviewSession',
        'handleGetSessionPatterns',
        'handleCheckConsistencyAlerts',
        'handleGetStreakRiskTiming',
        'handleGetReEngagementTiming',
    ]
    
    fixed_count = 0
    for handler_name in handlers_to_fix:
        # Pattern: export async function handlerName(
        pattern = f'export async function {handler_name}\('
        replacement = f'export function {handler_name}('
        
        if pattern in content:
            content = content.replace(pattern, replacement)
            fixed_count += 1
            print(f"Fixed {handler_name}")
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return fixed_count

if __name__ == "__main__":
    problem_fixed = fix_require_await_in_file("src/background/handlers/problemHandlers.js")
    session_fixed = fix_require_await_in_file("src/background/handlers/sessionHandlers.js")
    
    print(f"\nFixed {problem_fixed} handlers in problemHandlers.js")
    print(f"Fixed {session_fixed} handlers in sessionHandlers.js")
    print(f"Total: {problem_fixed + session_fixed} require-await warnings fixed")
