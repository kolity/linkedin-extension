/**
 * Useful SQL queries for LinkedIn data analysis
 * These can be run in pgAdmin or any PostgreSQL client
 */

-- Get total number of profiles
SELECT COUNT(*) FROM profiles;

-- Get profiles collected today
SELECT COUNT(*) 
FROM profiles 
WHERE created_at >= CURRENT_DATE;

-- Get top 10 companies by profile count
SELECT company, COUNT(*) as profile_count
FROM profiles
WHERE company IS NOT NULL AND company != ''
GROUP BY company
ORDER BY profile_count DESC
LIMIT 10;

-- Get most common job titles
SELECT title, COUNT(*) as title_count
FROM profiles
WHERE title IS NOT NULL AND title != ''
GROUP BY title
ORDER BY title_count DESC
LIMIT 20;

-- Get top 10 skills across all profiles
SELECT s.name, COUNT(*) as total_profiles, 
       AVG(s.endorsements) as avg_endorsements
FROM skills s
GROUP BY s.name
ORDER BY total_profiles DESC
LIMIT 10;

-- Find profiles with specific skills (e.g., 'Python')
SELECT p.id, p.name, p.title, p.company, p.url, s.endorsements
FROM profiles p
JOIN skills s ON p.id = s.profile_id
WHERE s.name ILIKE '%Python%'
ORDER BY s.endorsements DESC;

-- Get job changes in the last 6 months
SELECT p.name, e.company_name, e.title, e.date_range
FROM profiles p
JOIN experiences e ON p.id = e.profile_id
WHERE e.is_current = true
AND p.created_at >= NOW() - INTERVAL '6 months'
ORDER BY p.created_at DESC;

-- Find people who worked at a specific company (e.g., 'Google')
SELECT DISTINCT p.id, p.name, p.title, p.url
FROM profiles p
JOIN experiences e ON p.id = e.profile_id
WHERE e.company_name ILIKE '%Google%'
ORDER BY p.name;

-- Find people who went to a specific school (e.g., 'Stanford')
SELECT DISTINCT p.id, p.name, p.title, p.company, p.url
FROM profiles p
JOIN education e ON p.id = e.profile_id
WHERE e.school_name ILIKE '%Stanford%'
ORDER BY p.name;

-- Get career progression for a specific profile
SELECT e.company_name, e.title, e.date_range
FROM experiences e
WHERE e.profile_id = 123  -- Replace with actual profile ID
ORDER BY e.is_current DESC;

-- Find people with both specific skills and company experience
SELECT DISTINCT p.id, p.name, p.title, p.url
FROM profiles p
JOIN experiences e ON p.id = e.profile_id
JOIN skills s ON p.id = s.profile_id
WHERE e.company_name ILIKE '%Amazon%'
AND s.name ILIKE '%Machine Learning%'
ORDER BY p.name;

-- Get profiles with the most skills
SELECT p.id, p.name, COUNT(s.id) as skill_count
FROM profiles p
JOIN skills s ON p.id = s.profile_id
GROUP BY p.id, p.name
ORDER BY skill_count DESC
LIMIT 10;

-- Find profiles with email addresses
SELECT p.id, p.name, p.title, p.company, c.email
FROM profiles p
JOIN contact_info c ON p.id = c.profile_id
WHERE c.email IS NOT NULL AND c.email != ''
ORDER BY p.created_at DESC;

-- Get collection statistics by source
SELECT source, COUNT(*) as profile_count
FROM profiles
GROUP BY source
ORDER BY profile_count DESC;

-- Find profiles from a specific location
SELECT id, name, title, company, url
FROM profiles
WHERE location ILIKE '%San Francisco%'
ORDER BY created_at DESC;

-- Get profiles updated in the last week
SELECT id, name, title, company, url, updated_at
FROM profiles
WHERE updated_at >= NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;

-- Find connections between people (those who worked at the same company)
SELECT p1.name as person1, p2.name as person2, e1.company_name
FROM profiles p1
JOIN experiences e1 ON p1.id = e1.profile_id
JOIN experiences e2 ON e1.company_name = e2.company_name AND e1.profile_id != e2.profile_id
JOIN profiles p2 ON e2.profile_id = p2.id
WHERE e1.company_name != ''
ORDER BY e1.company_name, p1.name, p2.name;

-- Find popular career transitions (which companies people move between)
SELECT 
    e1.company_name AS from_company,
    e2.company_name AS to_company,
    COUNT(*) AS transition_count
FROM 
    profiles p
JOIN 
    experiences e1 ON p.id = e1.profile_id
JOIN 
    experiences e2 ON p.id = e2.profile_id
WHERE 
    e1.company_name != e2.company_name
    AND e1.company_name != ''
    AND e2.company_name != ''
    -- This date comparison assumes date_range is in a format with ending date after "to" or "-"
    AND e1.date_range < e2.date_range
GROUP BY 
    e1.company_name, e2.company_name
ORDER BY 
    transition_count DESC
LIMIT 20;

-- Skills correlation analysis (which skills often appear together)
SELECT 
    s1.name AS skill1,
    s2.name AS skill2,
    COUNT(*) AS correlation_count
FROM 
    skills s1
JOIN 
    skills s2 ON s1.profile_id = s2.profile_id AND s1.id < s2.id
GROUP BY 
    s1.name, s2.name
ORDER BY 
    correlation_count DESC
LIMIT 30;

-- Education to career path analysis (which companies hire from which schools)
SELECT 
    edu.school_name,
    exp.company_name,
    COUNT(DISTINCT p.id) AS profile_count
FROM 
    profiles p
JOIN 
    education edu ON p.id = edu.profile_id
JOIN 
    experiences exp ON p.id = exp.profile_id AND exp.is_current = true
WHERE 
    edu.school_name != '' 
    AND exp.company_name != ''
GROUP BY 
    edu.school_name, exp.company_name
ORDER BY 
    profile_count DESC
LIMIT 20;