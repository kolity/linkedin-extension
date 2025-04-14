// --------------------------------------------------
// File: backend-api-example/models/profile.js
// --------------------------------------------------
// MongoDB model for LinkedIn profiles

const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  companyName: String,
  title: String,
  dateRange: String,
  isCurrent: Boolean,
  location: String,
  description: String
});

const educationSchema = new mongoose.Schema({
  schoolName: String,
  degree: String,
  fieldOfStudy: String,
  dateRange: String
});

const skillSchema = new mongoose.Schema({
  name: String,
  endorsements: Number
});

const contactInfoSchema = new mongoose.Schema({
  email: String,
  phone: String,
  profileUrl: String,
  website: String,
  twitter: String
});

const profileSchema = new mongoose.Schema({
  name: String,
  title: String,
  company: String,
  location: String,
  about: String,
  url: {
    type: String,
    required: true,
    unique: true
  },
  linkedinId: String,
  imageUrl: String,
  experiences: [experienceSchema],
  education: [educationSchema],
  skills: [skillSchema],
  contactInfo: contactInfoSchema,
  source: String,
  collectedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Profile', profileSchema);