/**
 * Database Field Naming Consistency Verification Tool
 * 
 * This utility verifies that the database contains only snake_case field names
 * and reports any remaining PascalCase or camelCase field inconsistencies.
 * 
 * Run this after the field standardization to ensure complete consistency.
 */

import { getAllFromStore } from '../db/common.js';

/**
 * Expected snake_case field names for each store
 */
const EXPECTED_FIELDS = {
  problems: {
    required: ['leetcode_id', 'description', 'difficulty', 'box_level', 'attempt_stats'],
    optional: ['tags', 'review_schedule', 'last_attempt_date', 'next_problem', 'created_at'],
    nested: {
      attempt_stats: ['total_attempts', 'successful_attempts']
    }
  },
  attempts: {
    required: ['id', 'problem_id', 'success', 'attempt_date', 'time_spent'],
    optional: ['session_id', 'difficulty', 'tags', 'comments']
  },
  sessions: {
    required: ['id', 'date', 'problems'],
    optional: ['attempts'],
    nested: {
      problems: ['id', 'leetcode_id', 'selection_reason'],
      attempts: ['attempt_id', 'problem_id', 'success', 'time_spent']
    }
  },
  problem_relationships: {
    required: ['id', 'problem_id1', 'problem_id2'],
    optional: ['strength', 'relationship_type']
  },
  hint_interactions: {
    required: ['id', 'problem_id', 'hint_type', 'timestamp'],
    optional: ['session_id', 'box_level', 'user_action', 'problem_difficulty', 'tags_combination', 'primary_tag', 'related_tag']
  },
  pattern_ladders: {
    required: ['tag', 'problems'],
    optional: ['last_updated', 'progress']
  }
};

/**
 * Problematic field names that should not exist (PascalCase/camelCase variants)
 */
const PROBLEMATIC_FIELDS = [
  // Problems store
  'leetCodeID', 'ProblemDescription', 'Difficulty', 'BoxLevel', 'AttemptStats', 'ReviewSchedule', 'TotalAttempts', 'SuccessfulAttempts',
  
  // Attempts store  
  'problemId', 'ProblemID', 'sessionId', 'SessionID', 'timeSpent', 'TimeSpent', 'attemptDate', 'AttemptDate',
  
  // Sessions store
  'Date', 'leetCodeID', 'selectionReason', 'attemptId',
  
  // Hint interactions
  'problemId', 'hintType', 'sessionId', 'boxLevel', 'userAction', 'problemDifficulty', 'tagsCombination', 'primaryTag', 'relatedTag'
];

/**
 * Verify field naming consistency for a single store
 */
async function verifyStore(storeName) {
  console.log(`🔍 Verifying ${storeName} store...`);
  
  try {
    const records = await getAllFromStore(storeName);
    const issues = [];
    
    if (!records || records.length === 0) {
      console.log(`  ℹ️  Store ${storeName} is empty`);
      return { store: storeName, recordCount: 0, issues: [] };
    }
    
    // Check each record for problematic fields
    records.forEach((record, index) => {
      const recordIssues = checkRecordFields(record, storeName, index);
      issues.push(...recordIssues);
    });
    
    if (issues.length === 0) {
      console.log(`  ✅ ${storeName}: ${records.length} records - All fields use correct snake_case naming`);
    } else {
      console.log(`  ❌ ${storeName}: Found ${issues.length} field naming issues`);
      issues.forEach(issue => console.log(`    - ${issue}`));
    }
    
    return {
      store: storeName,
      recordCount: records.length,
      issues
    };
    
  } catch (error) {
    console.error(`❌ Error verifying ${storeName}:`, error);
    return {
      store: storeName,
      recordCount: 0,
      issues: [`Store access error: ${error.message}`]
    };
  }
}

/**
 * Check a single record for field naming issues
 */
function checkRecordFields(record, storeName, recordIndex) {
  const issues = [];
  
  // Check for problematic top-level fields
  PROBLEMATIC_FIELDS.forEach(badField => {
    if (Object.prototype.hasOwnProperty.call(record, badField)) {
      issues.push(`Record ${recordIndex}: Found problematic field '${badField}'`);
    }
  });
  
  // Check nested objects for problematic fields
  if (storeName === 'problems' && record.attempt_stats) {
    ['TotalAttempts', 'SuccessfulAttempts'].forEach(badField => {
      if (Object.prototype.hasOwnProperty.call(record.attempt_stats, badField)) {
        issues.push(`Record ${recordIndex}: Found problematic nested field 'attempt_stats.${badField}'`);
      }
    });
  }
  
  return issues;
}

/**
 * Run complete database consistency verification
 */
export async function verifyDatabaseConsistency() {
  console.log('🚀 Starting Database Field Naming Consistency Verification...\n');
  
  const storesToVerify = Object.keys(EXPECTED_FIELDS);
  const results = [];
  
  for (const storeName of storesToVerify) {
    const result = await verifyStore(storeName);
    results.push(result);
  }
  
  // Summary report
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('='.repeat(50));
  
  const totalRecords = results.reduce((sum, r) => sum + r.recordCount, 0);
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  
  console.log(`Total records checked: ${totalRecords}`);
  console.log(`Total issues found: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log('\n🎉 SUCCESS: Database field naming is completely consistent!');
    console.log('All stores use proper snake_case field naming.');
  } else {
    console.log('\n⚠️  ISSUES FOUND: Some inconsistencies remain');
    console.log('Consider running data cleanup utilities to fix remaining issues.');
  }
  
  return {
    success: totalIssues === 0,
    totalRecords,
    totalIssues,
    results
  };
}

/**
 * Quick verification for development/testing
 */
export async function quickVerify() {
  console.log('🔧 Quick Database Consistency Check...');
  
  try {
    const result = await verifyDatabaseConsistency();
    return result.success;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

// Export for use in browser console during development
if (typeof window !== 'undefined') {
  window.verifyDatabaseConsistency = verifyDatabaseConsistency;
  window.quickVerify = quickVerify;
  console.log('🔧 Database verification tools available: verifyDatabaseConsistency(), quickVerify()');
}