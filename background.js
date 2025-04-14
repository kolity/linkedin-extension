// --------------------------------------------------
// File: background.js
// --------------------------------------------------
// Background script for the LinkedIn Data Collector

// Global state
let autoCollectEnabled = false;
let collectionSettings = {};
let processingQueue = false;
let readyState = false;

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
    
    // Signal that background script is ready
    readyState = true;
    console.log("Background script initialized and ready");
  });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Special isReady check message for checking background availability
  if (request.action === "isReady") {
    sendResponse({ready: readyState});
    return true; // Keep channel open for async response
  }
  
  // If not ready yet, inform the sender
  if (!readyState) {
    sendResponse({error: "Background script not fully initialized"});
    return true;
  }
  
  try {
    switch (request.action) {
      case "toggleAutoCollect":
        autoCollectEnabled = request.enabled;
        if (request.settings) {
          collectionSettings = request.settings;
        }
        sendResponse({success: true, autoCollectEnabled});
        break;
        
      case "processQueue":
        if (!processingQueue) {
          // Start queue processing in background
          processQueue(request.settings)
            .then(() => console.log("Queue processing completed"))
            .catch(err => console.error("Queue processing error:", err));
          
          sendResponse({success: true, message: "Queue processing started"});
        } else {
          sendResponse({success: false, message: "Queue already processing"});
        }
        break;
        
      case "addToQueue":
        addProfileToQueue(request.profileData)
          .then(result => sendResponse({success: true, ...result}))
          .catch(err => sendResponse({success: false, error: err.message}));
        return true; // Keep channel open for async response
        
      default:
        sendResponse({success: false, error: "Unknown action"});
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({success: false, error: error.message});
  }
  
  return true; // Keep channel open for async response
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
async function addProfileToQueue(profileData) {
  return new Promise((resolve, reject) => {
    try {
      if (!profileData || !profileData.url) {
        reject(new Error("Invalid profile data"));
        return;
      }
      
      chrome.storage.local.get({queue: []}, function(data) {
        // Check if already in queue
        const isDuplicate = data.queue.some(item => item.url === profileData.url);
        
        if (!isDuplicate) {
          const newQueue = [...data.queue, profileData];
          chrome.storage.local.set({queue: newQueue}, function() {
            // Update queue count
            chrome.storage.local.get({queueCount: 0}, function(stats) {
              chrome.storage.local.set({queueCount: stats.queueCount + 1});
              resolve({added: true, queueCount: stats.queueCount + 1});
            });
          });
        } else {
          resolve({added: false, reason: "duplicate"});
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Process profiles in queue
async function processQueue(settings) {
  // Prevent multiple queue processing
  if (processingQueue) {
    throw new Error("Queue processing already in progress");
  }
  
  processingQueue = true;
  
  try {
    // Get the queue
    return new Promise((resolve, reject) => {
      chrome.storage.local.get({queue: []}, async function(data) {
        const queue = data.queue;
        
        if (queue.length === 0) {
          processingQueue = false;
          resolve({processed: 0});
          return;
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // Process each profile
        for (let i = 0; i < queue.length; i++) {
          const profile = queue[i];
          
          // Update badge with remaining count
          updateBadge(queue.length - i);
          
          try {
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
              await updateStats();
              
              successCount++;
            } catch (error) {
              console.error('Error processing profile:', error);
              failCount++;
            } finally {
              // Close the tab
              try {
                await closeTab(tab.id);
              } catch (err) {
                console.warn("Error closing tab:", err);
              }
            }
            
            // Wait before processing next
            await sleep(settings?.delay ? settings.delay * 1000 : 3000);
          } catch (error) {
            console.error('Error in profile processing loop:', error);
            failCount++;
          }
        }
        
        // Clear the queue
        chrome.storage.local.set({queue: [], queueCount: 0});
        
        // Clear badge
        updateBadge(0);
        
        processingQueue = false;
        resolve({processed: successCount, failed: failCount});
      });
    });
  } catch (error) {
    processingQueue = false;
    throw error;
  }
}

// Create a new tab
function createTab(url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({url: url, active: false}, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(tab);
      }
    });
  });
}

// Close a tab
function closeTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
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
    // First check if content script is loaded in the tab
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      function: () => typeof contentScriptLoaded !== "undefined"
    }, function(results) {
      if (chrome.runtime.lastError) {
        reject(new Error("Content script not accessible: " + chrome.runtime.lastError.message));
        return;
      }
      
      // If content script isn't loaded, inject it
      if (!results || !results[0] || !results[0].result) {
        console.log("Content script not loaded, injecting now");
        // Inject content script
        chrome.scripting.executeScript({
          target: {tabId: tabId},
          files: ["content.js"]
        }, function() {
          if (chrome.runtime.lastError) {
            reject(new Error("Failed to inject content script: " + chrome.runtime.lastError.message));
            return;
          }
          
          // Wait for script to initialize
          setTimeout(() => {
            // Now try to collect the profile data
            sendCollectProfileMessage(tabId, settings, resolve, reject);
          }, 1000);
        });
      } else {
        // Content script is already loaded, proceed
        sendCollectProfileMessage(tabId, settings, resolve, reject);
      }
    });
  });
}

// Send message to content script to collect profile
function sendCollectProfileMessage(tabId, settings, resolve, reject) {
  chrome.tabs.sendMessage(tabId, {
    action: "collectProfile",
    settings: settings
  }, function(response) {
    if (chrome.runtime.lastError) {
      reject(new Error("Error sending message to content script: " + chrome.runtime.lastError.message));
    } else if (response && response.success) {
      resolve(response.profileData);
    } else {
      reject(new Error(response?.error || 'Failed to collect profile data'));
    }
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
      
      console.log("Sending profile to API:", profileData);
      console.log("API URL:", `${settings.apiUrl}/profiles`);
      
      // Directly use fetch in background script (service worker)
      const response = await fetch(`${settings.apiUrl}/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': settings.apiKey ? `Bearer ${settings.apiKey}` : ''
        },
        body: JSON.stringify(profileData)
      });
      
      // Get response as text first for debugging
      const responseText = await response.text();
      console.log("API Response Status:", response.status);
      console.log("API Response Body:", responseText);
      
      // Parse JSON response if it's valid
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("Error parsing API response:", e);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }
      
      if (response.ok) {
        console.log('Profile sent to API successfully', result);
        chrome.storage.local.set({connectionStatus: 'connected'});
        return result;
      } else {
        throw new Error(`API error: ${response.status} - ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error('API error:', error);
      chrome.storage.local.set({connectionStatus: 'disconnected'});
      throw error;
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
  return new Promise((resolve) => {
    chrome.storage.local.get({
      profilesCollected: 0,
      todayCount: 0
    }, function(data) {
      chrome.storage.local.set({
        profilesCollected: data.profilesCollected + 1,
        todayCount: data.todayCount + 1
      }, resolve);
    });
  });
}

// Initialize API settings when available
chrome.storage.sync.get(['apiUrl', 'apiKey'], function(settings) {
  if (settings.apiUrl) {
    console.log("API settings loaded successfully");
  }
});

// Listen for tab updates to implement auto-collection
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only proceed if auto-collect is enabled and page is complete
  if (!autoCollectEnabled || changeInfo.status !== 'complete') {
    return;
  }
  
  // Check if this is a LinkedIn profile page
  if (tab.url && tab.url.match(/linkedin\.com\/in\/[^\/]+\/?$/)) {
    console.log("Auto-collect: LinkedIn profile detected");
    
    // Wait a moment for page to fully render
    setTimeout(() => {
      // Collect the profile data
      collectProfileData(tabId, collectionSettings)
        .then(profileData => {
          console.log("Auto-collect: Profile data collected");
          return sendProfileToApi(profileData);
        })
        .then(() => {
          console.log("Auto-collect: Profile sent to API");
          return updateStats();
        })
        .then(() => {
          console.log("Auto-collect: Stats updated");
        })
        .catch(error => {
          console.error("Auto-collect error:", error);
        });
    }, 2000);
  }
});