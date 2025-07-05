"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.cleanupOldRecords = exports.getAverageResponseTime = exports.calculateUptime = exports.getProviderHistory = exports.saveStatusResults = exports.saveStatusResult = exports.getLastStatus = exports.initDatabase = exports.getDatabaseInstance = exports.getDatabase = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const logger_1 = require("./logger");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const email_notifications_1 = require("./email-notifications");
const webhook_notifications_1 = require("./webhook-notifications");
const incident_tracking_1 = require("./incident-tracking");
let db = null;
/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}
exports.getDatabase = getDatabase;
/**
 * Get database instance (alias for external use)
 */
function getDatabaseInstance() {
    return getDatabase();
}
exports.getDatabaseInstance = getDatabaseInstance;
/**
 * Initialize the SQLite database
 */
async function initDatabase() {
    if (db)
        return;
    try {
        // Ensure data directory exists
        const dataDir = path_1.default.join(process.cwd(), 'data');
        await promises_1.default.mkdir(dataDir, { recursive: true });
        // Open database
        db = await (0, sqlite_1.open)({
            filename: path_1.default.join(dataDir, 'status-history.db'),
            driver: sqlite3_1.default.Database
        });
        (0, logger_1.log)('info', 'Database opened successfully');
        // Create tables if they don't exist
        await createTables();
    }
    catch (error) {
        (0, logger_1.log)('error', 'Failed to initialize database', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}
exports.initDatabase = initDatabase;
/**
 * Create database tables
 */
async function createTables() {
    if (!db)
        throw new Error('Database not initialized');
    // Status history table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      status TEXT NOT NULL,
      response_time INTEGER NOT NULL,
      error TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create index for faster queries
    await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_status_history_provider_checked 
    ON status_history(provider_id, checked_at)
  `);
    // Health check history table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS health_check_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      healthy BOOLEAN NOT NULL,
      response_time INTEGER NOT NULL,
      error TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_health_check_provider_checked 
    ON health_check_history(provider_id, checked_at)
  `);
    (0, logger_1.log)('info', 'Database tables created/verified');
}
/**
 * Get the last status for a provider
 */
async function getLastStatus(providerId) {
    if (!db)
        await initDatabase();
    if (!db)
        throw new Error('Database not initialized');
    const result = await db.get(`SELECT provider_id, provider_name, status, response_time, error, checked_at
     FROM status_history 
     WHERE provider_id = ?
     ORDER BY checked_at DESC 
     LIMIT 1`, providerId);
    if (!result)
        return null;
    return {
        id: result.provider_id,
        name: result.provider_name,
        status: result.status,
        responseTime: result.response_time,
        error: result.error,
        lastChecked: result.checked_at,
        statusPageUrl: '' // Not stored in DB
    };
}
exports.getLastStatus = getLastStatus;
/**
 * Save status result to database with notifications
 */
async function saveStatusResult(result) {
    if (!db)
        await initDatabase();
    if (!db)
        throw new Error('Database not initialized');
    try {
        // Get previous status for comparison
        const previousStatus = await getLastStatus(result.id);
        // Save to database
        await db.run(`INSERT INTO status_history (provider_id, provider_name, status, response_time, error, checked_at)
       VALUES (?, ?, ?, ?, ?, ?)`, result.id, result.name, result.status, result.responseTime, result.error || null, result.lastChecked);
        // Trigger notifications if status changed
        if (previousStatus && previousStatus.status !== result.status) {
            (0, logger_1.log)('info', 'Status change detected, triggering notifications', {
                provider: result.id,
                change: `${previousStatus.status} → ${result.status}`
            });
            // Process email notifications
            (0, email_notifications_1.processStatusChange)(result, previousStatus);
            // Process webhook notifications
            (0, webhook_notifications_1.processWebhookStatusChange)(result, previousStatus);
            // Process incident tracking
            (0, incident_tracking_1.createIncidentFromStatusChange)(result, previousStatus);
            (0, incident_tracking_1.checkIncidentResolution)(result, previousStatus);
        }
    }
    catch (error) {
        (0, logger_1.log)('error', 'Failed to save status result', {
            provider: result.id,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
exports.saveStatusResult = saveStatusResult;
/**
 * Save multiple status results
 */
async function saveStatusResults(results) {
    if (!db)
        await initDatabase();
    if (!db)
        throw new Error('Database not initialized');
    const stmt = await db.prepare(`INSERT INTO status_history (provider_id, provider_name, status, response_time, error, checked_at)
     VALUES (?, ?, ?, ?, ?, ?)`);
    try {
        for (const result of results) {
            await stmt.run(result.id, result.name, result.status, result.responseTime, result.error || null, result.lastChecked);
        }
    }
    finally {
        await stmt.finalize();
    }
    (0, logger_1.log)('info', 'Saved status results to database', { count: results.length });
}
exports.saveStatusResults = saveStatusResults;
/**
 * Get status history for a provider
 */
async function getProviderHistory(providerId, hours = 24) {
    if (!db)
        await initDatabase();
    if (!db)
        throw new Error('Database not initialized');
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return db.all(`SELECT * FROM status_history 
     WHERE provider_id = ? AND checked_at >= ?
     ORDER BY checked_at DESC`, providerId, since);
}
exports.getProviderHistory = getProviderHistory;
/**
 * Calculate uptime percentage for a provider
 */
async function calculateUptime(providerId, hours = 24) {
    if (!db)
        await initDatabase();
    if (!db)
        throw new Error('Database not initialized');
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const result = await db.get(`SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as operational
     FROM status_history 
     WHERE provider_id = ? AND checked_at >= ?`, providerId, since);
    if (!result || result.total === 0)
        return 100; // No data means assume 100%
    return Math.round((result.operational / result.total) * 100 * 100) / 100;
}
exports.calculateUptime = calculateUptime;
/**
 * Get average response time for a provider
 */
async function getAverageResponseTime(providerId, hours = 24) {
    if (!db)
        await initDatabase();
    if (!db)
        throw new Error('Database not initialized');
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const result = await db.get(`SELECT AVG(response_time) as avg_response_time
     FROM status_history 
     WHERE provider_id = ? AND checked_at >= ? AND status != 'unknown'`, providerId, since);
    return Math.round((result === null || result === void 0 ? void 0 : result.avg_response_time) || 0);
}
exports.getAverageResponseTime = getAverageResponseTime;
/**
 * Clean up old records (keep 30 days)
 */
async function cleanupOldRecords() {
    if (!db)
        await initDatabase();
    if (!db)
        throw new Error('Database not initialized');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const statusResult = await db.run('DELETE FROM status_history WHERE checked_at < ?', thirtyDaysAgo);
    const healthResult = await db.run('DELETE FROM health_check_history WHERE checked_at < ?', thirtyDaysAgo);
    (0, logger_1.log)('info', 'Cleaned up old records', {
        statusDeleted: statusResult.changes,
        healthDeleted: healthResult.changes
    });
}
exports.cleanupOldRecords = cleanupOldRecords;
/**
 * Close database connection
 */
async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
        (0, logger_1.log)('info', 'Database closed');
    }
}
exports.closeDatabase = closeDatabase;
//# sourceMappingURL=database.js.map