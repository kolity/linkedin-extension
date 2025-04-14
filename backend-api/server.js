// Example Node.js backend API with PostgreSQL for the LinkedIn Data Collector

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const profileService = require('./services/profileService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/linkedin_data',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Pass DB pool to the profile service
profileService.initialize(pool);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Database connection check
app.use(async (req, res, next) => {
  try {
    // Ping database on each request to ensure connection
    await pool.query('SELECT NOW()');
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ success: false, error: 'Database connection error' });
  }
});

// Simple health check endpoint
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Test database connection endpoint
app.get('/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    
    res.json({ 
      success: true, 
      message: 'Database connection successful',
      timestamp: result.rows[0].time
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Direct insert test endpoint
app.get('/test-insert', async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log("Starting test insert transaction");
    await client.query('BEGIN');
    
    const testUrl = 'https://www.linkedin.com/in/test-user-' + Date.now();
    console.log("Inserting test profile with URL:", testUrl);
    
    const insertResult = await client.query(
      `INSERT INTO profiles 
       (name, title, company, url, source, collected_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [
        'Test User',
        'Test Title',
        'Test Company',
        testUrl,
        'test',
        new Date()
      ]
    );
    
    const profileId = insertResult.rows[0].id;
    console.log("Test profile inserted with ID:", profileId);
    
    await client.query('COMMIT');
    console.log("Transaction committed");
    
    res.json({ 
      success: true, 
      message: 'Test profile inserted successfully',
      profileId,
      url: testUrl
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Test insert failed:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// List tables endpoint
app.get('/debug/tables', async (req, res) => {
  try {
    const client = await pool.connect();
    const tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    client.release();
    
    res.json({
      success: true,
      tables: tablesResult.rows.map(row => row.table_name)
    });
  } catch (error) {
    console.error('Error listing tables:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save a single profile
app.post('/profiles', async (req, res) => {
  try {
    console.log("=== PROFILE REQUEST RECEIVED ===");
    console.log("Headers:", JSON.stringify(req.headers));
    console.log("Body:", JSON.stringify(req.body));
    
    const profileData = req.body;
    
    // Check for required fields
    if (!profileData || !profileData.url) {
      console.log("Missing required field: url");
      return res.status(400).json({ success: false, error: 'URL is required' });
    }
    
    console.log("Saving profile to database:", profileData.url);
    
    try {
      // Check if profile already exists and update or create
      const result = await profileService.saveProfile(profileData);
      
      console.log("Profile saved successfully:", result.updated ? "Updated" : "Created new", "ID:", result.profile.id);
      
      res.json({ 
        success: true, 
        message: result.updated ? 'Profile updated' : 'Profile saved',
        profile: result.profile,
        updated: result.updated
      });
    } catch (serviceError) {
      console.error('Error in profile service:', serviceError);
      res.status(500).json({ 
        success: false, 
        error: serviceError.message,
        stack: process.env.NODE_ENV === 'development' ? serviceError.stack : undefined
      });
    }
  } catch (error) {
    console.error('Error handling profile request:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Bulk save profiles
app.post('/profiles/bulk', async (req, res) => {
  try {
    console.log("=== BULK PROFILES REQUEST RECEIVED ===");
    console.log("Number of profiles:", req.body.profiles ? req.body.profiles.length : 0);
    
    const { profiles } = req.body;
    
    if (!profiles || !Array.isArray(profiles)) {
      return res.status(400).json({ success: false, error: 'Invalid profiles data' });
    }
    
    // Process all profiles
    console.log("Processing bulk profiles");
    const results = await profileService.bulkSaveProfiles(profiles);
    
    console.log("Bulk processing completed:", results);
    
    res.json({ 
      success: true, 
      message: `Processed ${profiles.length} profiles`,
      results
    });
  } catch (error) {
    console.error('Error bulk saving profiles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all profiles with pagination
app.get('/profiles', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    console.log(`Getting profiles with limit=${limit}, offset=${offset}`);
    
    const result = await profileService.getProfiles(limit, offset);
    
    console.log(`Retrieved ${result.profiles.length} profiles out of ${result.total} total`);
    
    res.json({
      success: true,
      profiles: result.profiles,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.profiles.length < result.total
      }
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a specific profile by URL
app.get('/profiles/url/:encodedUrl', async (req, res) => {
  try {
    const url = decodeURIComponent(req.params.encodedUrl);
    console.log("Looking up profile by URL:", url);
    
    const profile = await profileService.getProfileByUrl(url);
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Profile not found' 
      });
    }
    
    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Error fetching profile by URL:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stats
app.get('/stats', async (req, res) => {
  try {
    console.log("Getting stats");
    const stats = await profileService.getStats();
    
    console.log("Stats retrieved:", stats);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API health check available at http://localhost:${PORT}/ping`);
  console.log(`Database test available at http://localhost:${PORT}/test-db`);
  console.log(`Test insert available at http://localhost:${PORT}/test-insert`);
});

// Handle server shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('Shutting down server...');
  
  try {
    // Close database pool
    await pool.end();
    console.log('Database pool closed');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
  
  process.exit(0);
}