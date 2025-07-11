#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');




// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
  
  
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = getFirestore();

// Open SQLite database
const dbPath = path.join(process.cwd(), 'status.db');

if (!fs.existsSync(dbPath)) {
  
  createSampleData();
  return;
}

const sqliteDb = new sqlite3.Database(dbPath);

async function migrateStatusResults() {
  
  
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM status_results ORDER BY checked_at DESC LIMIT 1000', async (err, rows) => {
      if (err) {
        
        reject(err);
        return;
      }

      const batch = db.batch();
      let count = 0;

      for (const row of rows) {
        const docRef = db.collection('status_results').doc();
        batch.set(docRef, {
          provider_id: row.provider_id,
          status: row.status,
          response_time: row.response_time,
          error_message: row.error_message || null,
          checked_at: new Date(row.checked_at),
          created_at: new Date()
        });
        count++;
      }

      if (count > 0) {
        await batch.commit();
        
      } else {
        
      }
      
      resolve();
    });
  });
}

async function migrateComments() {
  
  
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM comments ORDER BY created_at DESC', async (err, rows) => {
      if (err) {
        // Comments table might not exist
        
        resolve();
        return;
      }

      const batch = db.batch();
      let count = 0;

      for (const row of rows) {
        const docRef = db.collection('comments').doc();
        batch.set(docRef, {
          content: row.content,
          author: row.author,
          type: row.type || 'general',
          provider_id: row.provider_id || null,
          parent_id: row.parent_id || null,
          status: row.status || 'approved',
          likes: row.likes || 0,
          reports: row.reports || 0,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at || row.created_at)
        });
        count++;
      }

      if (count > 0) {
        await batch.commit();
        
      } else {
        
      }
      
      resolve();
    });
  });
}

async function createSampleData() {
  
  
  const providers = [
    'openai', 'anthropic', 'huggingface', 'google-ai', 
    'cohere', 'replicate', 'groq', 'deepseek'
  ];
  
  const batch = db.batch();
  
  // Create recent status results for each provider
  for (const provider of providers) {
    for (let i = 0; i < 10; i++) {
      const docRef = db.collection('status_results').doc();
      const date = new Date();
      date.setMinutes(date.getMinutes() - (i * 5)); // Every 5 minutes
      
      batch.set(docRef, {
        provider_id: provider,
        status: Math.random() > 0.1 ? 'operational' : 'degraded', // 90% operational
        response_time: Math.floor(Math.random() * 200) + 50, // 50-250ms
        error_message: null,
        checked_at: date,
        created_at: new Date()
      });
    }
  }
  
  // Create sample comments
  const sampleComments = [
    { content: 'OpenAI API is working great today!', author: 'Developer1', type: 'feedback', provider_id: 'openai' },
    { content: 'Having some issues with Anthropic responses', author: 'User2', type: 'issue', provider_id: 'anthropic' },
    { content: 'Love this status dashboard!', author: 'Fan3', type: 'general', provider_id: null },
  ];
  
  for (const comment of sampleComments) {
    const docRef = db.collection('comments').doc();
    batch.set(docRef, {
      ...comment,
      status: 'approved',
      likes: Math.floor(Math.random() * 10),
      reports: 0,
      parent_id: null,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  
  await batch.commit();
  
}

async function runMigration() {
  try {
    await migrateStatusResults();
    await migrateComments();
    
    
    
    
    
    
    
  } catch (error) {
    
    process.exit(1);
  } finally {
    if (sqliteDb) {
      sqliteDb.close();
    }
    process.exit(0);
  }
}

runMigration(); 