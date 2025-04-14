/**
 * Service for managing LinkedIn profiles in PostgreSQL
 */

let pool;

// Initialize with database pool
function initialize(dbPool) {
  pool = dbPool;
}

// Save a single profile
async function saveProfile(profileData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if profile exists
    const checkResult = await client.query(
      'SELECT id FROM profiles WHERE url = $1',
      [profileData.url]
    );
    
    let profileId;
    let isUpdate = false;
    
    if (checkResult.rows.length > 0) {
      // Update existing profile
      profileId = checkResult.rows[0].id;
      isUpdate = true;
      
      await client.query(
        `UPDATE profiles 
         SET name = $1, title = $2, company = $3, location = $4, about = $5,
             linkedin_id = $6, image_url = $7, source = $8, collected_at = $9, updated_at = NOW()
         WHERE id = $10`,
        [
          profileData.name,
          profileData.title,
          profileData.company,
          profileData.location,
          profileData.about,
          profileData.linkedinId,
          profileData.imageUrl,
          profileData.source,
          profileData.collectedAt ? new Date(profileData.collectedAt) : new Date(),
          profileId
        ]
      );
      
      // Delete existing related data
      await client.query('DELETE FROM experiences WHERE profile_id = $1', [profileId]);
      await client.query('DELETE FROM education WHERE profile_id = $1', [profileId]);
      await client.query('DELETE FROM skills WHERE profile_id = $1', [profileId]);
      await client.query('DELETE FROM contact_info WHERE profile_id = $1', [profileId]);
      
    } else {
      // Insert new profile
      const result = await client.query(
        `INSERT INTO profiles 
         (name, title, company, location, about, url, linkedin_id, image_url, source, collected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          profileData.name,
          profileData.title,
          profileData.company,
          profileData.location,
          profileData.about,
          profileData.url,
          profileData.linkedinId,
          profileData.imageUrl,
          profileData.source,
          profileData.collectedAt ? new Date(profileData.collectedAt) : new Date()
        ]
      );
      
      profileId = result.rows[0].id;
    }
    
    // Insert experiences
    if (profileData.experiences && Array.isArray(profileData.experiences)) {
      for (const exp of profileData.experiences) {
        await client.query(
          `INSERT INTO experiences 
           (profile_id, company_name, title, date_range, is_current, location, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            profileId,
            exp.companyName,
            exp.title,
            exp.dateRange,
            exp.isCurrent || false,
            exp.location,
            exp.description
          ]
        );
      }
    }
    
    // Insert education
    if (profileData.education && Array.isArray(profileData.education)) {
      for (const edu of profileData.education) {
        await client.query(
          `INSERT INTO education 
           (profile_id, school_name, degree, field_of_study, date_range)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            profileId,
            edu.schoolName,
            edu.degree,
            edu.fieldOfStudy,
            edu.dateRange
          ]
        );
      }
    }
    
    // Insert skills
    if (profileData.skills && Array.isArray(profileData.skills)) {
      for (const skill of profileData.skills) {
        await client.query(
          `INSERT INTO skills 
           (profile_id, name, endorsements)
           VALUES ($1, $2, $3)`,
          [
            profileId,
            skill.name,
            skill.endorsements || 0
          ]
        );
      }
    }
    
    // Insert contact info
    if (profileData.contactInfo) {
      await client.query(
        `INSERT INTO contact_info 
         (profile_id, email, phone, profile_url, website, twitter)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          profileId,
          profileData.contactInfo.email,
          profileData.contactInfo.phone,
          profileData.contactInfo.profileUrl,
          profileData.contactInfo.website,
          profileData.contactInfo.twitter
        ]
      );
    }
    
    await client.query('COMMIT');
    
    // Get complete profile
    const profile = await getProfileById(profileId);
    
    return {
      profile,
      updated: isUpdate
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Bulk save profiles
async function bulkSaveProfiles(profiles) {
  const results = {
    added: 0,
    updated: 0,
    failed: 0
  };
  
  for (const profileData of profiles) {
    try {
      const result = await saveProfile(profileData);
      if (result.updated) {
        results.updated++;
      } else {
        results.added++;
      }
    } catch (error) {
      console.error('Error processing profile:', error);
      results.failed++;
    }
  }
  
  return results;
}

// Get profile by ID with all related data
async function getProfileById(profileId) {
  const client = await pool.connect();
  
  try {
    // Get profile
    const profileResult = await client.query(
      'SELECT * FROM profiles WHERE id = $1',
      [profileId]
    );
    
    if (profileResult.rows.length === 0) {
      throw new Error('Profile not found');
    }
    
    const profile = profileResult.rows[0];
    
    // Get experiences
    const experiencesResult = await client.query(
      'SELECT * FROM experiences WHERE profile_id = $1 ORDER BY is_current DESC',
      [profileId]
    );
    
    // Get education
    const educationResult = await client.query(
      'SELECT * FROM education WHERE profile_id = $1',
      [profileId]
    );
    
    // Get skills
    const skillsResult = await client.query(
      'SELECT * FROM skills WHERE profile_id = $1 ORDER BY endorsements DESC',
      [profileId]
    );
    
    // Get contact info
    const contactInfoResult = await client.query(
      'SELECT * FROM contact_info WHERE profile_id = $1',
      [profileId]
    );
    
    // Format profile object
    return {
      id: profile.id,
      name: profile.name,
      title: profile.title,
      company: profile.company,
      location: profile.location,
      about: profile.about,
      url: profile.url,
      linkedinId: profile.linkedin_id,
      imageUrl: profile.image_url,
      source: profile.source,
      collectedAt: profile.collected_at,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      experiences: experiencesResult.rows.map(exp => ({
        id: exp.id,
        companyName: exp.company_name,
        title: exp.title,
        dateRange: exp.date_range,
        isCurrent: exp.is_current,
        location: exp.location,
        description: exp.description
      })),
      education: educationResult.rows.map(edu => ({
        id: edu.id,
        schoolName: edu.school_name,
        degree: edu.degree,
        fieldOfStudy: edu.field_of_study,
        dateRange: edu.date_range
      })),
      skills: skillsResult.rows.map(skill => ({
        id: skill.id,
        name: skill.name,
        endorsements: skill.endorsements
      })),
      contactInfo: contactInfoResult.rows.length > 0 ? {
        email: contactInfoResult.rows[0].email,
        phone: contactInfoResult.rows[0].phone,
        profileUrl: contactInfoResult.rows[0].profile_url,
        website: contactInfoResult.rows[0].website,
        twitter: contactInfoResult.rows[0].twitter
      } : null
    };
  } finally {
    client.release();
  }
}

// Get profiles with pagination
async function getProfiles(limit, offset) {
  const client = await pool.connect();
  
  try {
    // Get total count
    const countResult = await client.query('SELECT COUNT(*) FROM profiles');
    const total = parseInt(countResult.rows[0].count);
    
    // Get profiles with pagination
    const profilesResult = await client.query(
      'SELECT * FROM profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    const profiles = [];
    
    // Get related data for each profile
    for (const profile of profilesResult.rows) {
      profiles.push(await getProfileById(profile.id));
    }
    
    return {
      total,
      profiles
    };
  } finally {
    client.release();
  }
}

// Get stats
async function getStats() {
  const client = await pool.connect();
  
  try {
    // Get total count
    const totalResult = await client.query('SELECT COUNT(*) FROM profiles');
    const total = parseInt(totalResult.rows[0].count);
    
    // Get today's count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayResult = await client.query(
      'SELECT COUNT(*) FROM profiles WHERE created_at >= $1',
      [today]
    );
    const todayCount = parseInt(todayResult.rows[0].count);
    
    // Get sources breakdown
    const sourcesResult = await client.query(
      'SELECT source, COUNT(*) FROM profiles GROUP BY source'
    );
    
    const sources = {};
    for (const row of sourcesResult.rows) {
      sources[row.source || 'unknown'] = parseInt(row.count);
    }
    
    // Get top companies
    const companiesResult = await client.query(
      'SELECT company, COUNT(*) as count FROM profiles WHERE company IS NOT NULL AND company != \'\' GROUP BY company ORDER BY count DESC LIMIT 10'
    );
    
    return {
      total,
      todayCount,
      sources,
      topCompanies: companiesResult.rows
    };
  } finally {
    client.release();
  }
}

module.exports = {
  initialize,
  saveProfile,
  bulkSaveProfiles,
  getProfileById,
  getProfiles,
  getStats
};