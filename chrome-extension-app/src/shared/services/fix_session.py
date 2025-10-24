with open('sessionService.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
i = 0
while i < len(lines):
    # Check if we're at the debug logging block
    if i < len(lines) - 1 and '// 🐛 DEBUG: Log accuracy calculation details' in lines[i]:
        # Add the comment
        output.append(lines[i])
        i += 1
        # Skip the console.log block (lines until we find the closing });)
        while i < len(lines) and '});' not in lines[i]:
            i += 1
        if i < len(lines):
            i += 1  # Skip the }); line
        # Add the helper call
        output.append('      logAccuracyCalculation(sessionId, session.attempts, session.accuracy);\n')
    # Check if we're at the cache clearing block
    elif '// ✅ Clear session cache since session status changed' in lines[i]:
        # Replace entire block with helper call
        output.append('      // ✅ Clear session and analytics caches\n')
        output.append('      clearSessionCaches(sessionId);\n')
        i += 1
        # Skip until we find the second catch block closing
        cache_blocks = 0
        while i < len(lines):
            if 'try {' in lines[i]:
                cache_blocks += 1
            if cache_blocks == 2 and '}' in lines[i] and 'catch' not in lines[i-1] if i > 0 else False:
                i += 1
                break
            i += 1
    else:
        output.append(lines[i])
        i += 1

with open('sessionService.js', 'w', encoding='utf-8') as f:
    f.writelines(output)

print("✅ Fixed sessionService.js")
