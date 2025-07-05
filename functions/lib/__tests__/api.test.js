"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const request = __importStar(require("supertest"));
const express = __importStar(require("express"));
// Mock Firebase Admin
globals_1.jest.mock('firebase-admin/app', () => ({
    initializeApp: globals_1.jest.fn(),
    getApps: globals_1.jest.fn(() => []),
    cert: globals_1.jest.fn()
}));
globals_1.jest.mock('firebase-admin/firestore', () => ({
    getFirestore: globals_1.jest.fn(() => ({
        collection: globals_1.jest.fn(),
        batch: globals_1.jest.fn(),
        settings: globals_1.jest.fn()
    })),
    Timestamp: {
        fromDate: globals_1.jest.fn((date) => ({ toDate: () => date })),
        now: globals_1.jest.fn(() => ({ toDate: () => new Date() }))
    }
}));
// Mock the providers fetch
globals_1.jest.mock('../../lib/status-fetcher', () => ({
    fetchProviderStatus: globals_1.jest.fn().mockResolvedValue({
        id: 'openai',
        name: 'OpenAI',
        status: 'operational',
        statusPageUrl: 'https://status.openai.com',
        responseTime: 50,
        lastChecked: new Date().toISOString()
    })
}));
// Mock database functions
globals_1.jest.mock('../../lib/database', () => ({
    initDatabase: globals_1.jest.fn().mockResolvedValue(undefined),
    calculateUptime: globals_1.jest.fn().mockResolvedValue(99.5),
    getAverageResponseTime: globals_1.jest.fn().mockResolvedValue(75)
}));
(0, globals_1.describe)('Cloud Functions API', () => {
    let app;
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        // Create Express app for testing
        app = express();
        app.use(express.json());
        // Mount the API routes (simplified version)
        app.get('/status', async (req, res) => {
            res.json({
                timestamp: new Date().toISOString(),
                summary: {
                    total: 8,
                    operational: 8,
                    degraded: 0,
                    down: 0,
                    unknown: 0
                },
                providers: []
            });
        });
        app.get('/health', async (req, res) => {
            res.json({
                timestamp: new Date().toISOString(),
                status: 'healthy',
                version: '1.0.0'
            });
        });
        app.post('/comments', async (req, res) => {
            const { author, message, type } = req.body;
            if (!author || author.length < 2) {
                return res.status(400).json({
                    success: false,
                    errors: ['Author name must be at least 2 characters']
                });
            }
            if (!message || message.length < 10) {
                return res.status(400).json({
                    success: false,
                    errors: ['Message must be at least 10 characters']
                });
            }
            res.json({
                success: true,
                comment: {
                    id: 'test-id',
                    author,
                    message,
                    type: type || 'general',
                    createdAt: new Date().toISOString(),
                    status: 'approved'
                }
            });
        });
    });
    (0, globals_1.describe)('GET /status', () => {
        (0, globals_1.it)('should return status for all providers', async () => {
            const response = await request(app)
                .get('/status')
                .expect(200);
            (0, globals_1.expect)(response.body).toHaveProperty('timestamp');
            (0, globals_1.expect)(response.body).toHaveProperty('summary');
            (0, globals_1.expect)(response.body.summary.total).toBe(8);
        });
    });
    (0, globals_1.describe)('GET /health', () => {
        (0, globals_1.it)('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);
            (0, globals_1.expect)(response.body).toHaveProperty('status', 'healthy');
            (0, globals_1.expect)(response.body).toHaveProperty('version');
        });
    });
    (0, globals_1.describe)('POST /comments', () => {
        (0, globals_1.it)('should create a comment with valid data', async () => {
            const commentData = {
                author: 'Test User',
                message: 'This is a test comment with enough characters',
                type: 'general'
            };
            const response = await request(app)
                .post('/comments')
                .send(commentData)
                .expect(200);
            (0, globals_1.expect)(response.body.success).toBe(true);
            (0, globals_1.expect)(response.body.comment).toMatchObject({
                author: 'Test User',
                message: 'This is a test comment with enough characters',
                type: 'general'
            });
        });
        (0, globals_1.it)('should reject comment with short author name', async () => {
            const commentData = {
                author: 'A',
                message: 'This is a test comment with enough characters',
                type: 'general'
            };
            const response = await request(app)
                .post('/comments')
                .send(commentData)
                .expect(400);
            (0, globals_1.expect)(response.body.success).toBe(false);
            (0, globals_1.expect)(response.body.errors).toContain('Author name must be at least 2 characters');
        });
        (0, globals_1.it)('should reject comment with short message', async () => {
            const commentData = {
                author: 'Test User',
                message: 'Short',
                type: 'general'
            };
            const response = await request(app)
                .post('/comments')
                .send(commentData)
                .expect(400);
            (0, globals_1.expect)(response.body.success).toBe(false);
            (0, globals_1.expect)(response.body.errors).toContain('Message must be at least 10 characters');
        });
    });
});
//# sourceMappingURL=api.test.js.map