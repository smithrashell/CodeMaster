#!/usr/bin/env python3
import re

file_path = r'C:\Users\rashe\Projects\CodingProjects\CodeMaster\chrome-extension-app\src\shared\services\sessionService.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the _doGetOrCreateSession function
old_func = r'''  async _doGetOrCreateSession\(sessionType = 'standard'\) \{
    logger\.info\(`🔍 _doGetOrCreateSession ENTRY: sessionType=\$\{sessionType\}`\);

    logger\.info\(`🔍 Getting settings\.\.\.\`\);
    // Skip migration - just get settings directly \(has built-in fallbacks and defaults\)
    const _settings = await StorageService\.getSettings\(\);
    logger\.info\(`✅ Settings loaded successfully`\);
    // StorageService\.getSettings\(\) always returns settings \(defaults if needed\), no null check required

    // Try atomic resume/create to prevent race conditions
    logger\.info\(`🔍 Attempting atomic resume or create for \$\{sessionType\}\.\.\.\`\);

    // First try to find existing in_progress sessions using atomic operation
    let session = await getOrCreateSessionAtomic\(sessionType, 'in_progress', null\);
    if \(session\) \{
      logger\.info\("✅ Found existing in_progress session:", session\.id\);
      return session;
    \}

    logger\.info\(`🆕 No existing session found, creating new \$\{sessionType\} session`\);

    // Create new session as in_progress
    // Note: createNewSession has its own check for existing sessions and will mark them completed
    const newSession = await this\.createNewSession\(sessionType\);

    logger\.info\(`✅ New session created:`, newSession\?\.id\);
    return newSession;
  \},'''

new_func = '''  async _doGetOrCreateSession(sessionType = 'standard') {
    logger.info(`🔍 _doGetOrCreateSession ENTRY: sessionType=${sessionType}`);

    // 🔒 RACE CONDITION FIX: Check if another request is already creating a session for this type
    if (sessionCreationLocks.has(sessionType)) {
      logger.info(`⏳ Another request is creating ${sessionType} session, waiting...`);
      const existingPromise = sessionCreationLocks.get(sessionType);
      return await existingPromise;
    }

    // Create promise for this session creation to prevent concurrent creates
    const creationPromise = (async () => {
      try {
        logger.info(`🔍 Getting settings...`);
        const _settings = await StorageService.getSettings();
        logger.info(`✅ Settings loaded successfully`);

        // Try atomic resume/create to prevent race conditions
        logger.info(`🔍 Attempting atomic resume or create for ${sessionType}...`);

        // First try to find existing in_progress sessions using atomic operation
        let session = await getOrCreateSessionAtomic(sessionType, 'in_progress', null);
        if (session) {
          logger.info("✅ Found existing in_progress session:", session.id);
          return session;
        }

        logger.info(`🆕 No existing session found, creating new ${sessionType} session`);

        // Create new session as in_progress
        const newSession = await this.createNewSession(sessionType);

        logger.info(`✅ New session created:`, newSession?.id);
        return newSession;
      } finally {
        // Release lock after creation completes (success or failure)
        sessionCreationLocks.delete(sessionType);
        logger.info(`🔓 Released session creation lock for ${sessionType}`);
      }
    })();

    // Store promise to block concurrent requests
    sessionCreationLocks.set(sessionType, creationPromise);

    return await creationPromise;
  },'''

content = re.sub(old_func, new_func, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Race condition fix applied!")
