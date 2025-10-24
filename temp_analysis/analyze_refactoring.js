// Extract function calls, await statements, and conditional branches
const fs = require('fs');

function extractLogicalOperations(code) {
  const operations = {
    functionCalls: [],
    awaitStatements: [],
    conditionals: [],
    assignments: [],
    returns: [],
    errorHandling: []
  };
  
  // Extract await statements
  const awaitMatches = code.match(/await\s+\w+\([^)]*\)/g) || [];
  operations.awaitStatements = awaitMatches;
  
  // Extract function calls (approximate)
  const callMatches = code.match(/\b\w+\([^)]*\)/g) || [];
  operations.functionCalls = callMatches.filter(call => 
    !call.startsWith('if') && !call.startsWith('for') && !call.startsWith('while')
  );
  
  // Extract conditionals
  const conditionalMatches = code.match(/if\s*\([^)]+\)/g) || [];
  operations.conditionals = conditionalMatches;
  
  // Extract return statements
  const returnMatches = code.match(/return\s+[^;]+;/g) || [];
  operations.returns = returnMatches;
  
  // Extract try-catch blocks
  const tryCatchMatches = code.match(/try\s*\{[\s\S]*?\}\s*catch/g) || [];
  operations.errorHandling = tryCatchMatches;
  
  return operations;
}

// Read both versions
const sourceCode = fs.readFileSync('temp_analysis/source_version.js', 'utf8');
const currentCode = fs.readFileSync('chrome-extension-app/src/background/index.js', 'utf8');

// Extract the four refactored functions
const functionNames = [
  'testOnboardingDetection',
  'testDifficultyProgression',
  'testCoreSessionValidation',
  'testFirstUserOnboarding'
];

console.log('=== CAPABILITY LOSS ANALYSIS ===\n');

functionNames.forEach(funcName => {
  console.log(`\n## Analyzing: ${funcName}`);
  
  // Extract function from source
  const sourceRegex = new RegExp(`globalThis\.${funcName}\s*=\s*async\s*function[\s\S]*?(?=\n    globalThis\.|\n    // |$)`, 'g');
  const sourceMatch = sourceCode.match(sourceRegex);
  const currentMatch = currentCode.match(sourceRegex);
  
  if (sourceMatch && currentMatch) {
    const sourceOps = extractLogicalOperations(sourceMatch[0]);
    const currentOps = extractLogicalOperations(currentMatch[0]);
    
    console.log(`  Source awaits: ${sourceOps.awaitStatements.length}, Current: ${currentOps.awaitStatements.length}`);
    console.log(`  Source conditionals: ${sourceOps.conditionals.length}, Current: ${currentOps.conditionals.length}`);
    console.log(`  Source returns: ${sourceOps.returns.length}, Current: ${currentOps.returns.length}`);
    console.log(`  Source error handling: ${sourceOps.errorHandling.length}, Current: ${currentOps.errorHandling.length}`);
    
    // Check for missing awaits
    const missingAwaits = sourceOps.awaitStatements.filter(stmt => 
      !currentOps.awaitStatements.includes(stmt)
    );
    
    if (missingAwaits.length > 0) {
      console.log(`  ⚠️  MISSING AWAITS: ${missingAwaits.length}`);
      missingAwaits.forEach(stmt => console.log(`      - ${stmt}`));
    }
  } else {
    console.log(`  ⚠️  Could not extract function`);
  }
});
