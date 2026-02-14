/**
 * Tests for backupDB.js
 *
 * Tests openBackupDB, backupIndexedDB, and getBackupFile using
 * fake-indexeddb via testDbHelper.
 */

jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

import { dbHelper } from '../../index.js';
import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';
import { openBackupDB, backupIndexedDB, getBackupFile } from '../backupDB.js';

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => closeTestDb(testDb));

// ---------------------------------------------------------------------------
// openBackupDB
// ---------------------------------------------------------------------------
describe('openBackupDB', () => {
  it('should return the main database via dbHelper.openDB', async () => {
    const db = await openBackupDB();
    expect(db).toBe(testDb.db);
    expect(dbHelper.openDB).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// backupIndexedDB
// ---------------------------------------------------------------------------
describe('backupIndexedDB', () => {
  it('should create a backup containing all stores and their data', async () => {
    // Seed some data
    await seedStore(testDb.db, 'problems', [
      { problem_id: 'p1', title: 'Two Sum', leetcode_id: 1 },
      { problem_id: 'p2', title: 'Add Two Numbers', leetcode_id: 2 },
    ]);
    await seedStore(testDb.db, 'sessions', [
      { id: 's1', date: '2024-01-01', status: 'completed' },
    ]);

    const result = await backupIndexedDB();

    expect(result).toEqual({ message: expect.stringContaining('Backup successful') });

    // Verify backup was written to backup_storage
    const backups = await readAll(testDb.db, 'backup_storage');
    expect(backups.length).toBe(1);
    expect(backups[0].backupId).toBe('latestBackup');
    expect(backups[0].data).toBeDefined();
    expect(backups[0].data.stores).toBeDefined();

    // Verify the backed-up data includes our seeded stores
    const backupData = backups[0].data;
    expect(backupData.stores.problems.data).toHaveLength(2);
    expect(backupData.stores.sessions.data).toHaveLength(1);
  });

  it('should return undefined when db is null', async () => {
    dbHelper.openDB.mockResolvedValue(null);

    const result = await backupIndexedDB();
    expect(result).toBeUndefined();
  });

  it('should include db metadata in backup', async () => {
    await backupIndexedDB();

    const backups = await readAll(testDb.db, 'backup_storage');
    const backupData = backups[0].data;
    expect(backupData.dbName).toBeDefined();
    expect(backupData.version).toBeDefined();
    expect(backupData.timestamp).toBeDefined();
  });

  it('should work with empty stores', async () => {
    const result = await backupIndexedDB();
    expect(result).toEqual({ message: expect.stringContaining('Backup successful') });

    const backups = await readAll(testDb.db, 'backup_storage');
    const backupData = backups[0].data;
    // All stores should be present with empty data arrays
    expect(backupData.stores.problems.data).toHaveLength(0);
    expect(backupData.stores.sessions.data).toHaveLength(0);
  });

  it('should overwrite previous backups since backupId is always latestBackup', async () => {
    // First backup
    await backupIndexedDB();

    // Add more data
    await seedStore(testDb.db, 'problems', [
      { problem_id: 'p3', title: 'Three Sum', leetcode_id: 3 },
    ]);

    // Second backup
    await backupIndexedDB();

    const backups = await readAll(testDb.db, 'backup_storage');
    // Should still be 1 because backupId is always 'latestBackup'
    expect(backups.length).toBe(1);
    // Should contain the new data (plus old)
    expect(backups[0].data.stores.problems.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// getBackupFile
// ---------------------------------------------------------------------------
describe('getBackupFile', () => {
  it('should return null when no backup exists', async () => {
    const result = await getBackupFile();
    expect(result).toBeNull();
  });

  it('should return backup data after a backup has been created', async () => {
    await seedStore(testDb.db, 'problems', [
      { problem_id: 'p1', title: 'Two Sum', leetcode_id: 1 },
    ]);

    await backupIndexedDB();

    const backupData = await getBackupFile();
    expect(backupData).toBeDefined();
    expect(backupData.stores).toBeDefined();
    expect(backupData.stores.problems.data).toHaveLength(1);
    expect(backupData.stores.problems.data[0].title).toBe('Two Sum');
  });

  it('should return data with timestamp and db name', async () => {
    await backupIndexedDB();

    const backupData = await getBackupFile();
    expect(backupData.timestamp).toBeDefined();
    expect(backupData.dbName).toBeDefined();
    expect(backupData.version).toBeDefined();
  });

  it('should throw when dbHelper.openDB fails', async () => {
    dbHelper.openDB.mockRejectedValue(new Error('DB connection failed'));

    await expect(getBackupFile()).rejects.toThrow('DB connection failed');
  });
});
