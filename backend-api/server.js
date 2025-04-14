// --------------------------------------------------
// File: backend-api-example/server.js
// --------------------------------------------------
// Example Node.js backend API for the LinkedIn Data Collector

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const Profile = require('./models/profile');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/linkedin_data', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Simple health check endpoint
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Save a single profile
app.post('/profiles', async (req, res) => {
  try {
    const profileData = req.body;
    
    // Check if profile already exists (based on LinkedIn URL)
    const existingProfile = await Profile.findOne({ url: profileData.url });
    
    if (existingProfile) {
      // Update existing profile
      const updatedProfile = await Profile.findByIdAndUpdate(
        existingProfile._id,
        { ...profileData, updatedAt: new Date() },
        { new: true }
      );
      
      res.json({ 
        success: true, 
        message: 'Profile updated',
        profile: updatedProfile,
        updated: true
      });
    } else {
      // Create new profile
      const profile = new Profile(profileData);
      await profile.save();
      
      res.json({ 
        success: true, 
        message: 'Profile saved',
        profile: profile,
        updated: false
      });
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk save profiles
app.post('/profiles/bulk', async (req, res) => {
  try {
    const { profiles } = req.body;
    
    if (!profiles || !Array.isArray(profiles)) {
      return res.status(400).json({ success: false, error: 'Invalid profiles data' });
    }
    
    const results = {
      added: 0,
      updated: 0,
      failed: 0
    };
    
    // Process each profile
    for (const profileData of profiles) {
      try {
        // Check if profile already exists
        const existingProfile = await Profile.findOne({ url: profileData.url });
        
        if (existingProfile) {
          // Update existing profile
          await Profile.findByIdAndUpdate(
            existingProfile._id,
            { ...profileData, updatedAt: new Date() }
          );
          results.updated++;
        } else {
          // Create new profile
          const profile = new Profile(profileData);
          await profile.save();
          results.added++;
        }
      } catch (error) {
        console.error('Error processing profile:', error);
        results.failed++;
      }
    }
    
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

// Get all profiles
app.get('/profiles', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;
    
    const profiles = await Profile.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    
    const total = await Profile.countDocuments();
    
    res.json({
      success: true,
      profiles,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + profiles.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stats
app.get('/stats', async (req, res) => {
  try {
    const total = await Profile.countDocuments();
    
    // Count profiles added today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Profile.countDocuments({ 
      createdAt: { $gte: today } 
    });
    
    // Count profiles by source
    const sources = await Profile.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    // Companies with most profiles
    const companies = await Profile.aggregate([
      { $match: { 'company': { $exists: true, $ne: '' } } },
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      stats: {
        total,
        todayCount,
        sources: sources.reduce((acc, src) => {
          acc[src._id || 'unknown'] = src.count;
          return acc;
        }, {}),
        topCompanies: companies
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});