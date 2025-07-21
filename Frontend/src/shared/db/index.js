export const dbHelper = {
  dbName: "review",
  version: 24, // 🚨 Increment version to trigger upgrade (added session_analytics store)
  db: null,

  async openDB() {
    if (dbHelper.db) {
      return dbHelper.db; // Return cached database if already opened
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbHelper.dbName, dbHelper.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // ✅ Ensure 'attempts' store exists
        if (!db.objectStoreNames.contains("attempts")) {
          let attemptsStore = db.createObjectStore("attempts", {
            keyPath: "id",
            autoIncrement: true,
          });

          dbHelper.ensureIndex(attemptsStore, "by_date", "date");
          dbHelper.ensureIndex(attemptsStore, "by_problem_and_date", [
            "problemId",
            "date",
          ]);
          dbHelper.ensureIndex(attemptsStore, "by_problemId", "problemId");
          dbHelper.ensureIndex(attemptsStore, "by_sessionId", "sessionId");
        }

        // ✅ Ensure 'limits' store exists
        if (!db.objectStoreNames.contains("limits")) {
          let limitsStore = db.createObjectStore("limits", {
            keyPath: "id",
            autoIncrement: true,
          });

          dbHelper.ensureIndex(limitsStore, "by_createAt", "createAt");
        }

        // ✅ Ensure 'problem_relationships' store exists
        // if (db.objectStoreNames.contains("problem_relationships")) {
        //   db.deleteObjectStore("problem_relationships");
        // }
        if(!db.objectStoreNames.contains("session_state")){
          db.createObjectStore("session_state", {keyPath: "id"});
        }
       

        if (!db.objectStoreNames.contains("problem_relationships")) {
          let relationshipsStore = db.createObjectStore("problem_relationships");

          dbHelper.ensureIndex(relationshipsStore, "by_problemId1", "problemId1");
          dbHelper.ensureIndex(relationshipsStore, "by_problemId2", "problemId2");

        }
                

        // ✅ Ensure 'problems' store exists
        if (!db.objectStoreNames.contains("problems")) {
          let problemsStore = db.createObjectStore("problems", {
            keyPath: "leetCodeID",
          });

          dbHelper.ensureIndex(problemsStore, "by_tag", "tag");
          dbHelper.ensureIndex(problemsStore, "by_problem", "problem");
          dbHelper.ensureIndex(problemsStore, "by_review", "review");
          dbHelper.ensureIndex(
            problemsStore,
            "by_ProblemDescription",
            "ProblemDescription"
          );
          dbHelper.ensureIndex(problemsStore, "by_nextProblem", "nextProblem");
        }
        // ✅ Ensure 'sessions' store exists
        if (db.objectStoreNames.contains("sessions")) {
          db.deleteObjectStore("sessions");
        }

        // Recreate sessions store
        const sessionsStore = db.createObjectStore("sessions", {
          keyPath: "id",
          autoIncrement: false, // You manually set sessionID
        });

        // Create secondary index on Date, NOT unique
        sessionsStore.createIndex("by_date", "Date", { unique: false });

        console.log("Sessions store recreated!");
        // ✅ Ensure 'standard_problems' store exists
        if (!db.objectStoreNames.contains("standard_problems")) {
          let standardProblemsStore = db.createObjectStore(
            "standard_problems",
            {
              keyPath: "id",
              autoIncrement: true,
            }
          );

          dbHelper.ensureIndex(standardProblemsStore, "by_slug", "slug");
        }

        // ✅ Ensure 'backup_storage' store exists
        if (!db.objectStoreNames.contains("backup_storage")) {
          let backupStore = db.createObjectStore("backup_storage", {
            keyPath: "backupId",
          });

          dbHelper.ensureIndex(backupStore, "by_backupId", "backupId");
        }

        // ✅ Ensure 'tag_relationships' store exists
        let tagRelationshipsStore;
        if (!db.objectStoreNames.contains("tag_relationships")) {
          tagRelationshipsStore = db.createObjectStore("tag_relationships", {
            keyPath: "id",
          });
        } else {
          tagRelationshipsStore =
            event.target.transaction.objectStore("tag_relationships");
        }

        // ✅ Ensure index on 'classification' is created
        if (!tagRelationshipsStore.indexNames.contains("by_classification")) {
          tagRelationshipsStore.createIndex(
            "by_classification",
            "classification"
          );
        }

        console.log("Database upgrade completed");

        // ✅ **NEW: Ensure 'tag_mastery' store exists**
        if (!db.objectStoreNames.contains("tag_mastery")) {
          let tagMasteryStore = db.createObjectStore("tag_mastery", {
            keyPath: "tag",
          });

          dbHelper.ensureIndex(tagMasteryStore, "by_tag", "tag");
        }

        // ✅ **NEW: Ensure 'settings' store exists**
        if (!db.objectStoreNames.contains("settings")) {
          let settingsStore = db.createObjectStore("settings", {
            keyPath: "id",
          });
          
          console.log("Settings store created!");
        }
        //add a index on classification

        // // ✅ **NEW: Ensure 'user_stats' store exists**
        if (!db.objectStoreNames.contains("pattern_ladders")) {
          let patternLaddersStore = db.createObjectStore("pattern_ladders", {
            keyPath: "tag",
          });

          dbHelper.ensureIndex(patternLaddersStore, "by_tag", "tag");
        }

        // ✅ **NEW: Ensure 'session_analytics' store exists**
        if (!db.objectStoreNames.contains("session_analytics")) {
          let sessionAnalyticsStore = db.createObjectStore("session_analytics", {
            keyPath: "sessionId",
          });

          dbHelper.ensureIndex(sessionAnalyticsStore, "by_date", "completedAt");
          dbHelper.ensureIndex(sessionAnalyticsStore, "by_accuracy", "accuracy");
          dbHelper.ensureIndex(sessionAnalyticsStore, "by_difficulty", "predominantDifficulty");
          
          console.log("✅ Session analytics store created!");
        }
      };

      request.onsuccess = (event) => {
        dbHelper.db = event.target.result;
        console.log("✅ DB opened successfully (dbHelper working)");
        resolve(dbHelper.db);
      };

      request.onerror = (event) => reject(`❌ DB Error: ${event.target.error}`);
    });
  },

  ensureIndex(store, indexName, keyPath) {
    if (!store.indexNames.contains(indexName)) {
      store.createIndex(indexName, keyPath, { unique: false });
    }
  },

  async getStore(storeName, mode = "readonly") {
    if (!dbHelper.db) await dbHelper.openDB();
    return dbHelper.db.transaction(storeName, mode).objectStore(storeName);
  },
};
