"""
Remove duplicate switch cases from messageRouter.js after handler extraction.
These cases are now handled by the handler registry and are dead code.
"""

# List of case names to remove (23 handlers extracted to sessionHandlers and problemHandlers)
CASES_TO_REMOVE = [
    # Problem handlers (8)
    "getProblemByDescription",
    "countProblemsByBoxLevel",
    "addProblem",
    "problemSubmitted",
    "skipProblem",
    "getAllProblems",
    "getProblemById",
    "getProblemAttemptStats",
    # Session handlers (15)
    "getSession",
    "getOrCreateSession",
    "refreshSession",
    "getCurrentSession",
    "manualSessionCleanup",
    "getSessionAnalytics",
    "classifyAllSessions",
    "generateSessionFromTracking",
    "getSessionMetrics",
    "checkInterviewFrequency",
    "completeInterviewSession",
    "getSessionPatterns",
    "checkConsistencyAlerts",
    "getStreakRiskTiming",
    "getReEngagementTiming",
]

def find_case_block(lines, case_name, start_index=0):
    """Find the start and end of a case block."""
    case_start = None
    case_end = None
    
    # Find the case statement
    for i in range(start_index, len(lines)):
        if f'case "{case_name}":' in lines[i]:
            case_start = i
            break
    
    if case_start is None:
        return None, None
    
    # Find the end of this case (next case statement or default or closing brace)
    brace_count = 0
    in_case = False
    
    for i in range(case_start, len(lines)):
        line = lines[i].strip()
        
        # Track opening braces after case statement
        if i > case_start:
            if '{' in line:
                brace_count += line.count('{')
            if '}' in line:
                brace_count -= line.count('}')
        
        # Look for the next case or end
        if i > case_start:
            # If we find a return statement at the root level (brace_count == 0), that's likely the end
            if 'return true' in line or 'return false' in line:
                if brace_count == 0:
                    case_end = i + 1
                    break
            # If we hit another case at root level
            if line.startswith('case "') and brace_count == 0:
                case_end = i
                break
            # If we hit default at root level
            if line.startswith('default:') and brace_count == 0:
                case_end = i
                break
    
    return case_start, case_end

def remove_duplicate_cases(filename):
    """Remove all duplicate cases from the file."""
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    removed_cases = []
    lines_removed = 0
    
    for case_name in CASES_TO_REMOVE:
        case_start, case_end = find_case_block(lines, case_name)
        
        if case_start is not None and case_end is not None:
            print(f"Found {case_name}: lines {case_start + 1}-{case_end}")
            removed_cases.append((case_name, case_start, case_end))
        else:
            print(f"⚠️  Could not find {case_name}")
    
    # Remove cases in reverse order to preserve line numbers
    removed_cases.sort(key=lambda x: x[1], reverse=True)
    
    for case_name, start, end in removed_cases:
        print(f"Removing {case_name} (lines {start + 1}-{end})")
        del lines[start:end]
        lines_removed += (end - start)
    
    # Write back
    with open(filename, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print(f"\n✅ Removed {len(removed_cases)} duplicate cases ({lines_removed} lines)")
    print(f"Removed: {', '.join([c[0] for c in removed_cases])}")
    
    return len(removed_cases), lines_removed

if __name__ == "__main__":
    cases_removed, lines_removed = remove_duplicate_cases("src/background/messageRouter.js")
    print(f"\nFile updated: src/background/messageRouter.js")
    print(f"Cases removed: {cases_removed}")
    print(f"Lines removed: {lines_removed}")
