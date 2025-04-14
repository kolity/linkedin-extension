// --------------------------------------------------
// File: content.js
// --------------------------------------------------
// This script runs on LinkedIn pages to extract profile data

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.action) {
      case "checkProfile":
        checkForProfile(sendResponse);
        return true; // Keep channel open for async response
        
      case "collectProfile":
        collectProfile(request.settings, sendResponse);
        return true;
        
      case "getProfileBasic":
        getProfileBasic(sendResponse);
        return true;
        
      case "collectConnections":
        collectConnections(request.settings, sendResponse);
        return true;
        
      case "collectSearchResults":
        collectSearchResults(request.settings, sendResponse);
        return true;
    }
  });
  
  // Check if the current page is a LinkedIn profile
  function checkForProfile(sendResponse) {
    // Check URL pattern
    const isProfilePage = window.location.href.match(/linkedin\.com\/in\/[^\/]+\/?$/);
    
    if (isProfilePage) {
      // Basic profile data
      const profileData = extractBasicProfileData();
      sendResponse({isProfile: true, profileData: profileData});
    } else {
      sendResponse({isProfile: false});
    }
  }
  
  // Extract basic profile data
  function getProfileBasic(sendResponse) {
    const profileData = extractBasicProfileData();
    sendResponse({profileData: profileData});
  }
  
  // Extract detailed profile information
  function collectProfile(settings, sendResponse) {
    try {
      // Start with basic data
      const profileData = extractBasicProfileData();
      
      // Add additional data based on settings
      if (settings.collectExperiences) {
        profileData.experiences = extractExperiences();
      }
      
      if (settings.collectEducation) {
        profileData.education = extractEducation();
      }
      
      if (settings.collectSkills) {
        profileData.skills = extractSkills();
      }
      
      if (settings.collectContactInfo) {
        extractContactInfo().then(contactInfo => {
          profileData.contactInfo = contactInfo;
          // Send completed profile data
          sendResponse({success: true, profileData: profileData});
        }).catch(error => {
          console.error("Error collecting contact info:", error);
          // Continue without contact info
          sendResponse({success: true, profileData: profileData});
        });
      } else {
        // Send profile data without contact info
        sendResponse({success: true, profileData: profileData});
      }
    } catch (error) {
      console.error("Error collecting profile:", error);
      sendResponse({success: false, error: error.message});
    }
    
    return true; // Keep channel open for async response
  }
  
  // Extract basic profile information
  function extractBasicProfileData() {
    // Default empty object
    const profile = {
      url: window.location.href,
      collectedAt: new Date().toISOString()
    };
    
    try {
      // Name (multiple possible selectors for different LinkedIn layouts)
      const nameSelectors = [
        'h1.text-heading-xlarge',
        '.pv-top-card-section__name',
        '.pv-top-card--list li:first-child'
      ];
      
      for (const selector of nameSelectors) {
        const nameElement = document.querySelector(selector);
        if (nameElement) {
          profile.name = nameElement.textContent.trim();
          break;
        }
      }
      
      // Title
      const titleSelectors = [
        'div.text-body-medium',
        '.pv-top-card-section__headline',
        '.pv-top-card--list li:nth-child(2)'
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement) {
          profile.title = titleElement.textContent.trim();
          break;
        }
      }
      
      // Company/current position
      const companySelectors = [
        '.pv-top-card-v2-section__link-container span',
        '.pv-top-card-section__company',
        '.pv-top-card--list li:nth-child(3)'
      ];
      
      for (const selector of companySelectors) {
        const companyElement = document.querySelector(selector);
        if (companyElement) {
          profile.company = companyElement.textContent.trim();
          break;
        }
      }
      
      // Location
      const locationSelectors = [
        'span.text-body-small:not(.distance-badge)',
        '.pv-top-card-section__location',
        '.pv-top-card--list li:nth-child(4)'
      ];
      
      for (const selector of locationSelectors) {
        const locationElement = document.querySelector(selector);
        if (locationElement) {
          profile.location = locationElement.textContent.trim();
          break;
        }
      }
      
      // About/Summary
      const aboutSelectors = [
        '.pv-about-section .pv-about__summary-text',
        '#about + div + div .display-flex'
      ];
      
      for (const selector of aboutSelectors) {
        const aboutElement = document.querySelector(selector);
        if (aboutElement) {
          profile.about = aboutElement.textContent.trim();
          break;
        }
      }
      
      // Profile Image
      const imageSelectors = [
        'img.pv-top-card-profile-picture__image',
        '.pv-top-card__photo img'
      ];
      
      for (const selector of imageSelectors) {
        const imgElement = document.querySelector(selector);
        if (imgElement && imgElement.src) {
          profile.imageUrl = imgElement.src;
          break;
        }
      }
      
      // Get LinkedIn ID from URL
      const urlMatch = window.location.href.match(/linkedin\.com\/in\/([^\/]+)/);
      if (urlMatch && urlMatch[1]) {
        profile.linkedinId = urlMatch[1];
      }
      
    } catch (error) {
      console.error("Error extracting basic profile data:", error);
    }
    
    return profile;
  }
  
  // Extract experience information
  function extractExperiences() {
    const experiences = [];
    
    try {
      // Find the experience section
      const experienceSections = [
        '#experience ~ .pvs-list__outer-container .pvs-entity',
        '#experience-section .pv-entity__position-group-pager',
        '.experience-section .pv-entity'
      ];
      
      let experienceElements = [];
      
      for (const selector of experienceSections) {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          experienceElements = elements;
          break;
        }
      }
      
      // Process each experience
      experienceElements.forEach(item => {
        try {
          const experience = {};
          
          // Company name
          const companyElement = item.querySelector('.t-16, .pv-entity__secondary-title');
          if (companyElement) {
            experience.companyName = companyElement.textContent.trim();
          }
          
          // Title
          const titleElement = item.querySelector('span.t-bold, .pv-entity__summary-info-container span:first-child, .pv-entity__summary-info h3');
          if (titleElement) {
            experience.title = titleElement.textContent.trim();
          }
          
          // Dates
          const dateRangeElement = item.querySelector('.t-14.t-normal.t-black--light, .pv-entity__date-range span:nth-child(2)');
          if (dateRangeElement) {
            const dateText = dateRangeElement.textContent.trim();
            experience.dateRange = dateText;
            
            // Check if current
            experience.isCurrent = dateText.toLowerCase().includes('present');
          }
          
          // Location
          const locationElement = item.querySelector('.pv-entity__location span:nth-child(2)');
          if (locationElement) {
            experience.location = locationElement.textContent.trim();
          }
          
          // Description
          const descriptionElement = item.querySelector('.pv-entity__description');
          if (descriptionElement) {
            experience.description = descriptionElement.textContent.trim();
          }
          
          experiences.push(experience);
        } catch (error) {
          console.error("Error processing experience item:", error);
        }
      });
    } catch (error) {
      console.error("Error extracting experiences:", error);
    }
    
    return experiences;
  }
  
  // Extract education information
  function extractEducation() {
    const education = [];
    
    try {
      // Find the education section
      const educationSections = [
        '#education ~ .pvs-list__outer-container .pvs-entity',
        '#education-section .pv-education-entity',
        '.education-section .pv-entity'
      ];
      
      let educationElements = [];
      
      for (const selector of educationSections) {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          educationElements = elements;
          break;
        }
      }
      
      // Process each education
      educationElements.forEach(item => {
        try {
          const edu = {};
          
          // School name
          const schoolElement = item.querySelector('.t-16, .pv-entity__school-name');
          if (schoolElement) {
            edu.schoolName = schoolElement.textContent.trim();
          }
          
          // Degree
          const degreeElement = item.querySelector('.t-14.t-normal.t-black--light, .pv-entity__degree-name .pv-entity__comma-item');
          if (degreeElement) {
            edu.degree = degreeElement.textContent.trim();
          }
          
          // Field of study
          const fieldElement = item.querySelector('.pv-entity__fos .pv-entity__comma-item');
          if (fieldElement) {
            edu.fieldOfStudy = fieldElement.textContent.trim();
          }
          
          // Dates
          const dateElement = item.querySelector('.pv-entity__dates span:nth-child(2)');
          if (dateElement) {
            edu.dateRange = dateElement.textContent.trim();
          }
          
          education.push(edu);
        } catch (error) {
          console.error("Error processing education item:", error);
        }
      });
    } catch (error) {
      console.error("Error extracting education:", error);
    }
    
    return education;
  }
  
  // Extract skills
  function extractSkills() {
    const skills = [];
    
    try {
      // Find the skills section
      const skillSections = [
        '.pv-skill-categories-section ol > li',
        '.pv-skill-category-entity__top-skill .pv-skill-category-entity__name',
        '#skills ~ .pvs-list__outer-container .pvs-entity .t-black'
      ];
      
      let skillElements = [];
      
      for (const selector of skillSections) {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          skillElements = elements;
          break;
        }
      }
      
      // Process skills
      skillElements.forEach(item => {
        try {
          const skillName = item.textContent.trim();
          if (skillName) {
            const endorsementElement = item.closest('li').querySelector('.pv-skill-category-entity__endorsement-count');
            const endorsements = endorsementElement ? parseInt(endorsementElement.textContent.trim()) : 0;
            
            skills.push({
              name: skillName,
              endorsements: endorsements
            });
          }
        } catch (error) {
          console.error("Error processing skill item:", error);
        }
      });
      
      // Limited to top 20 skills to avoid excessive data
      return skills.slice(0, 20);
    } catch (error) {
      console.error("Error extracting skills:", error);
      return [];
    }
  }
  
  // Extract contact information (requires clicking a button)
  async function extractContactInfo() {
    return new Promise((resolve, reject) => {
      try {
        // Find and click the "Contact info" button
        const contactButtons = [
          'a[data-control-name="contact_see_more"]',
          'a.pv-top-card--contact-info',
          '.pv-top-card-v2-section__contact-info'
        ];
        
        let contactButton = null;
        
        for (const selector of contactButtons) {
          const button = document.querySelector(selector);
          if (button) {
            contactButton = button;
            break;
          }
        }
        
        if (!contactButton) {
          return resolve({}); // No contact info available
        }
        
        // Click the button
        contactButton.click();
        
        // Wait for the modal to appear
        setTimeout(() => {
          const contactInfo = {};
          
          // Extract email
          const emailElement = document.querySelector('.ci-email .pv-contact-info__ci-container a');
          if (emailElement) {
            contactInfo.email = emailElement.textContent.trim();
          }
          
          // Extract phone
          const phoneElement = document.querySelector('.ci-phone .pv-contact-info__ci-container span');
          if (phoneElement) {
            contactInfo.phone = phoneElement.textContent.trim();
          }
          
          // Extract LinkedIn profile URL
          const profileElement = document.querySelector('.ci-vanity-url .pv-contact-info__ci-container a');
          if (profileElement) {
            contactInfo.profileUrl = profileElement.href;
          }
          
          // Extract website
          const websiteElement = document.querySelector('.ci-websites .pv-contact-info__ci-container a');
          if (websiteElement) {
            contactInfo.website = websiteElement.href;
          }
          
          // Extract Twitter
          const twitterElement = document.querySelector('.ci-twitter .pv-contact-info__ci-container a');
          if (twitterElement) {
            contactInfo.twitter = twitterElement.textContent.trim();
          }
          
          // Close the modal
          const closeButton = document.querySelector('button[aria-label="Dismiss"]');
          if (closeButton) {
            closeButton.click();
          }
          
          resolve(contactInfo);
        }, 1000); // Wait for modal to load
      } catch (error) {
        console.error("Error extracting contact info:", error);
        reject(error);
      }
    });
  }
  
  // Collect connections from connections page
  function collectConnections(settings, sendResponse) {
    // Check if we're on the connections page
    if (!window.location.href.includes('linkedin.com/mynetwork/')) {
      sendResponse({started: false, error: 'Not on connections page'});
      return;
    }
    
    sendResponse({started: true});
    
    // Setup for tracking progress
    let processedCount = 0;
    const delay = settings.delay * 1000;
    
    // Create floating status indicator
    createStatusIndicator();
    updateStatusIndicator(`Starting collection...`);
    
    // Function to process connections
    function processConnections() {
      // Get all connection cards
      const connectionCards = document.querySelectorAll('li.mn-connection-card');
      
      if (connectionCards.length === 0) {
        updateStatusIndicator(`No connections found on page. Try scrolling to load more.`);
        return;
      }
      
      // Process one connection at a time with delay
      function processNextConnection(index) {
        if (index >= connectionCards.length) {
          // Scroll down to load more connections
          window.scrollTo(0, document.body.scrollHeight);
          
          // Wait and check if new connections loaded
          setTimeout(() => {
            const newCount = document.querySelectorAll('li.mn-connection-card').length;
            if (newCount > connectionCards.length) {
              // New connections loaded, process them
              processConnections();
            } else {
              updateStatusIndicator(`Completed collecting ${processedCount} connections`);
              setTimeout(() => removeStatusIndicator(), 5000);
            }
          }, 2000);
          return;
        }
        
        const card = connectionCards[index];
        
        try {
          // Extract data from the card
          const nameElement = card.querySelector('.mn-connection-card__name');
          const occupationElement = card.querySelector('.mn-connection-card__occupation');
          const profileLinkElement = card.querySelector('a.mn-connection-card__link');
          
          if (nameElement && profileLinkElement) {
            const profileData = {
              name: nameElement.textContent.trim(),
              title: occupationElement ? occupationElement.textContent.trim() : '',
              url: profileLinkElement.href,
              source: 'connections',
              collectedAt: new Date().toISOString()
            };
            
            // Add to queue
            chrome.runtime.sendMessage({
              action: 'addToQueue',
              profileData: profileData
            });
            
            processedCount++;
            updateStatusIndicator(`Collecting connections: ${processedCount} processed`);
          }
        } catch (error) {
          console.error('Error processing connection card:', error);
        }
        
        // Process next with delay
        setTimeout(() => processNextConnection(index + 1), delay);
      }
      
      // Start processing
      processNextConnection(0);
    }
    
    // Start the collection
    processConnections();
  }
  
  // Collect profiles from search results
  function collectSearchResults(settings, sendResponse) {
    // Check if we're on a search results page
    if (!window.location.href.includes('linkedin.com/search/results/')) {
      sendResponse({started: false, error: 'Not on search results page'});
      return;
    }
    
    sendResponse({started: true});
    
    // Setup for tracking progress
    let processedCount = 0;
    const delay = settings.delay * 1000;
    
    // Create floating status indicator
    createStatusIndicator();
    updateStatusIndicator(`Starting collection from search results...`);
    
    // Function to process search results
    function processSearchResults() {
      // Get all search result items (LinkedIn changes these selectors frequently)
      const resultSelectors = [
        '.search-result__info',
        '.reusable-search__result-container',
        '.entity-result__content'
      ];
      
      let resultElements = [];
      
      for (const selector of resultSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          resultElements = Array.from(elements);
          break;
        }
      }
      
      if (resultElements.length === 0) {
        updateStatusIndicator(`No search results found on page.`);
        return;
      }
      
      // Process one result at a time with delay
      function processNextResult(index) {
        if (index >= resultElements.length) {
          // Try to click "Next" button to load more results
          const nextButton = document.querySelector('.artdeco-pagination__button--next:not([disabled])');
          if (nextButton) {
            nextButton.click();
            updateStatusIndicator(`Loading next page of results...`);
            
            // Wait for next page to load and continue
            setTimeout(processSearchResults, 2000);
          } else {
            updateStatusIndicator(`Completed collecting ${processedCount} profiles from search`);
            setTimeout(() => removeStatusIndicator(), 5000);
          }
          return;
        }
        
        const result = resultElements[index];
        
        try {
          // Extract data from the result
          const nameElement = result.querySelector('.entity-result__title-text a, .actor-name');
          const titleElement = result.querySelector('.entity-result__primary-subtitle, .subline-level-1');
          const locationElement = result.querySelector('.entity-result__secondary-subtitle, .subline-level-2');
          
          if (nameElement) {
            const profileUrl = nameElement.href;
            if (profileUrl && profileUrl.includes('/in/')) {
              const profileData = {
                name: nameElement.textContent.trim().replace(/\s+/g, ' '), // Clean up extra whitespace
                title: titleElement ? titleElement.textContent.trim() : '',
                location: locationElement ? locationElement.textContent.trim() : '',
                url: profileUrl,
                source: 'search',
                collectedAt: new Date().toISOString()
              };
              
              // Add to queue
              chrome.runtime.sendMessage({
                action: 'addToQueue',
                profileData: profileData
              });
              
              processedCount++;
              updateStatusIndicator(`Collecting from search: ${processedCount} profiles added to queue`);
            }
          }
        } catch (error) {
          console.error('Error processing search result:', error);
        }
        
        // Process next with delay
        setTimeout(() => processNextResult(index + 1), delay);
      }
      
      // Start processing
      processNextResult(0);
    }
    
    // Start the collection
    processSearchResults();
  }
  
  // Create floating status indicator
  function createStatusIndicator() {
    removeStatusIndicator(); // Remove any existing indicators
    
    const statusDiv = document.createElement('div');
    statusDiv.id = 'linkedin-collector-status';
    statusDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(0, 119, 181, 0.9);
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    `;
    
    document.body.appendChild(statusDiv);
  }
  
  // Update floating status indicator
  function updateStatusIndicator(message) {
    const statusDiv = document.getElementById('linkedin-collector-status');
    if (statusDiv) {
      statusDiv.textContent = message;
    }
  }
  
  // Remove floating status indicator
  function removeStatusIndicator() {
    const statusDiv = document.getElementById('linkedin-collector-status');
    if (statusDiv) {
      statusDiv.remove();
    }
  }
  