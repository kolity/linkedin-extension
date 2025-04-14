// --------------------------------------------------
// File: background.js
// --------------------------------------------------
// Background script for the LinkedIn Data Collector

// Global state
let autoCollectEnabled = false;
let collectionSettings = {};
let processingQueue = false;

// Initialize
chrome.runtime.onInstalled.addListener(function() {
  console.log('LinkedIn Data Collector installed');
  
  // Reset daily count at midnight
  scheduleCounterReset();
  
  // Initialize default settings
  chrome.storage.sync.get({
    autoCollect: false
  }, function(items) {
    autoCollectEnabled = items.autoCollect;
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch (request.action) {
    case "toggleAutoCollect":
      autoCollectEnabled = request.enabled;
      if (request.settings) {
        collectionSettings = request.settings;
      }
      break;
      
    case "processQueue":
      if (!processingQueue) {
        processQueue(request.settings);
      }
      break;
      
    case "addToQueue":
      addProfileToQueue(request.profileData);
      break;
  }
});

// Schedule daily counter reset
function scheduleCounterReset() {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(function() {
    // Reset daily count
    chrome.storage.local.set({todayCount: 0});
    
    // Schedule next reset
    scheduleCounterReset();
  }, timeUntilMidnight);
}

// Add profile to queue
function addProfileToQueue(profileData) {
  chrome.storage.local.get({queue: []}, function(data) {
    // Check if already in queue
    const isDuplicate = data.queue.some(item => item.url === profileData.url);
    
    if (!isDuplicate) {
      const newQueue = [...data.queue, profileData];
      chrome.storage.local.set({queue: newQueue}, function() {
        // Update queue count
        chrome.storage.local.get({queueCount: 0}, function(stats) {
          chrome.storage.local.set({queueCount: stats.queueCount + 1});
        });
      });
    }
  });
}

// Process profiles in queue
async function processQueue(settings) {
  // Prevent multiple queue processing
  if (processingQueue) {
    return;
  }
  
  processingQueue = true;
  
  try {
    // Get the queue
    chrome.storage.local.get({queue: []}, async function(data) {
      const queue = data.queue;
      
      if (queue.length === 0) {
        processingQueue = false;
        return;
      }
      
      // Process each profile
      for (let i = 0; i < queue.length; i++) {
        const profile = queue[i];
        
        // Update badge with remaining count
        updateBadge(queue.length - i);
        
        // Open the profile in a new tab
        const tab = await createTab(profile.url);
        
        // Wait for page to load
        await sleep(3000);
        
        // Collect profile data
        try {
          const profileData = await collectProfileData(tab.id, settings);
          
          // Send to API
          await sendProfileToApi(profileData);
          
          // Update stats
          updateStats();
        } catch (error) {
          console.error('Error processing profile:', error);
        }
        
        // Close the tab
        chrome.tabs.remove(tab.id);
        
        // Wait before processing next
        await sleep(settings.delay * 1000);
      }
      
      // Clear the queue
      chrome.storage.local.set({queue: [], queueCount: 0});
      
      // Clear badge
      updateBadge(0);
      
      processingQueue = false;
    });
  } catch (error) {
    console.error('Error in queue processing:', error);
    processingQueue = false;
  }
}

// Create a new tab
function createTab(url) {
  return new Promise((resolve) => {
    chrome.tabs.create({url: url, active: false}, (tab) => {
      resolve(tab);
    });
  });
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Collect profile data from a tab
function collectProfileData(tabId, settings) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      action: "collectProfile",
      settings: settings
    }, function(response) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response && response.success) {
        resolve(response.profileData);
      } else {
        reject(new Error('Failed to collect profile data'));
      }
    });
  });
}

// Send profile data to API
async function sendProfileToApi(profileData) {
  try {
    const settings = await getApiSettings();
    
    if (!settings.apiUrl) {
      console.log('API URL not configured, storing locally only');
      return;
    }
    
    const response = await fetch(`${settings.apiUrl}/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': settings.apiKey ? `Bearer ${settings.apiKey}` : ''
      },
      body: JSON.stringify(profileData)
    });
    
    if (response.ok) {
      console.log('Profile sent to API successfully');
      chrome.storage.local.set({connectionStatus: 'connected'});
    } else {
      console.error('Failed to send profile to API: ' + response.status);
      chrome.storage.local.set({connectionStatus: 'disconnected'});
    }
  } catch (error) {
    console.error('API error:', error);
    chrome.storage.local.set({connectionStatus: 'disconnected'});
  }
}

// Get API settings
function getApiSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiUrl', 'apiKey'], function(settings) {
      resolve(settings);
    });
  });
}

// Update badge with queue count
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({text: count.toString()});
    chrome.action.setBadgeBackgroundColor({color: '#0077b5'});
  } else {
    chrome.action.setBadgeText({text: ''});
  }
}

// Update collection statistics
function updateStats() {
  chrome.storage.local.get({
    profilesCollected: 0,
    todayCount: 0
  }, function(data) {
    chrome.storage.local.set({
      profilesCollected: data.profilesCollected + 1,
      todayCount: data.todayCount + 1
    });
  });
}
