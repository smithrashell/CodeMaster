/**
 * Dashboard Data Structure Audit Script
 * Compares real dashboard service output with mock service output
 * to identify mismatches that need to be fixed in tests
 */

import { 
  getDashboardStatistics,
  getLearningProgressData,
  getGoalsData,
  getStatsData,
  getSessionHistoryData,
  getProductivityInsightsData,
  getTagMasteryData,
  getLearningPathData,
  getMistakeAnalysisData,
} from "../src/app/services/dashboardService.js";

import {
  getMockLearningProgressData,
  getMockGoalsData,
  getMockStatsData,
  getMockSessionHistoryData,
  getMockProductivityInsightsData,
  getMockTagMasteryData,
  getMockLearningPathData,
  getMockMistakeAnalysisData,
} from "../src/app/services/mockDashboardService.js";

// Helper function to get object structure for comparison
function getObjectStructure(obj, path = '') {
  if (obj === null || obj === undefined) return { [path]: 'null/undefined' };
  if (typeof obj !== 'object') return { [path]: typeof obj };
  if (Array.isArray(obj)) {
    const result = { [path]: 'array' };
    if (obj.length > 0) {
      Object.assign(result, getObjectStructure(obj[0], `${path}[0]`));
    }
    return result;
  }
  
  const result = { [path]: 'object' };
  Object.keys(obj).forEach(key => {
    Object.assign(result, getObjectStructure(obj[key], path ? `${path}.${key}` : key));
  });
  return result;
}

// Compare two data structures
function compareStructures(realData, mockData, serviceName) {
  console.log(`\n=== ${serviceName} ===`);
  
  const realStructure = getObjectStructure(realData);
  const mockStructure = getObjectStructure(mockData);
  
  const allPaths = new Set([...Object.keys(realStructure), ...Object.keys(mockStructure)]);
  const differences = [];
  
  allPaths.forEach(path => {
    const realType = realStructure[path];
    const mockType = mockStructure[path];
    
    if (realType !== mockType) {
      differences.push({
        path,
        real: realType || 'MISSING',
        mock: mockType || 'MISSING'
      });
    }
  });
  
  if (differences.length === 0) {
    console.log('✅ Structures match!');
  } else {
    console.log('❌ Structure differences found:');
    differences.forEach(diff => {
      console.log(`  ${diff.path}: Real(${diff.real}) vs Mock(${diff.mock})`);
    });
  }
  
  return differences;
}

// Audit functions for each service
const auditConfigs = [
  {
    name: 'Stats Data',
    realFunction: getStatsData,
    mockFunction: getMockStatsData
  },
  {
    name: 'Learning Progress Data',
    realFunction: getLearningProgressData,
    mockFunction: getMockLearningProgressData
  },
  {
    name: 'Goals Data',
    realFunction: getGoalsData,
    mockFunction: getMockGoalsData
  },
  {
    name: 'Session History Data', 
    realFunction: getSessionHistoryData,
    mockFunction: getMockSessionHistoryData
  },
  {
    name: 'Productivity Insights Data',
    realFunction: getProductivityInsightsData,
    mockFunction: getMockProductivityInsightsData
  },
  {
    name: 'Tag Mastery Data',
    realFunction: getTagMasteryData,
    mockFunction: getMockTagMasteryData
  },
  {
    name: 'Learning Path Data',
    realFunction: getLearningPathData,
    mockFunction: getMockLearningPathData
  },
  {
    name: 'Mistake Analysis Data',
    realFunction: getMistakeAnalysisData,
    mockFunction: getMockMistakeAnalysisData
  }
];

async function runAudit() {
  console.log('🔍 Starting Dashboard Data Structure Audit...\n');
  
  const allDifferences = {};
  
  for (const config of auditConfigs) {
    try {
      console.log(`Auditing ${config.name}...`);
      
      // Get real data (may require database setup)
      let realData;
      try {
        realData = await config.realFunction({});
      } catch (error) {
        console.log(`⚠️ Could not get real data for ${config.name}: ${error.message}`);
        realData = { error: 'Could not fetch real data' };
      }
      
      // Get mock data
      const mockData = await config.mockFunction();
      
      // Compare structures
      const differences = compareStructures(realData, mockData, config.name);
      if (differences.length > 0) {
        allDifferences[config.name] = differences;
      }
      
    } catch (error) {
      console.error(`❌ Error auditing ${config.name}:`, error.message);
    }
  }
  
  // Summary
  console.log('\n=== AUDIT SUMMARY ===');
  const servicesWithDifferences = Object.keys(allDifferences);
  
  if (servicesWithDifferences.length === 0) {
    console.log('🎉 All services have matching structures!');
  } else {
    console.log(`❌ ${servicesWithDifferences.length} services have structure mismatches:`);
    servicesWithDifferences.forEach(service => {
      console.log(`  - ${service} (${allDifferences[service].length} differences)`);
    });
    
    console.log('\n📋 Next steps:');
    console.log('1. Update mock services to match real service output structures');
    console.log('2. Update test expectations to use correct property names');
    console.log('3. Re-run this audit to verify fixes');
  }
}

// Run the audit
if (import.meta.url === `file://${process.argv[1]}`) {
  runAudit().catch(console.error);
}

export { runAudit, compareStructures, getObjectStructure };