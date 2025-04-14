/**
 * Database setup script
 * Run this to initialize the PostgreSQL database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to PostgreSQL server');
    
    // Create database if it doesn't exist
    const dbName = 'linkedin_data';
    
    // Check if database exists
    const checkDb = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    
    if (checkDb.rows.length === 0) {
      console.log(`Creating database: ${dbName}`);
      
      // Create the database
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log('Database created successfully');
    } else {
      console.log(`Database ${dbName} already exists`);
    }
    
    // Close connection to default database
    await client.release();
    
    // Connect to the linkedin_data database
    const linkedinClient = new Pool({
      connectionString: process.env.DATABASE_URL || `postgresql://postgres:postgres@localhost:5432/${dbName}`,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Read and execute the schema.sql file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Creating database schema...');
    await linkedinClient.query(schemaSql);
    console.log('Database schema created successfully');
    
    await linkedinClient.end();
    
    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase().catch(err => {
  console.error('Failed to set up database:', err);
  process.exit(1);
});