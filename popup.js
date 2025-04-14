
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI
    initTabs();
    loadSettings();
    loadStats();
    updateQueueTable();
    checkConnectionStatus();
    
    // Check if we're on a LinkedIn page when popup is opened
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      if (currentUrl.includes('linkedin.com')) {
        // Ask the content script if there's a profile on the current page
        chrome.tabs.sendMessage(tabs[0].id, {action: "checkProfile"}, function(response) {
          if (response && response.isProfile) {
            updateCurrentProfile(response.profileData);
          } else {
            document.getElementById('currentProfile').textContent = 'No profile detected on this page';
          }
        });
      } else {
        document.getElementById('currentProfile').textContent = 'Please navigate to LinkedIn to collect data';
      }
    });
    
    // Set up event listeners
    document.getElementById('collectProfile').addEventListener('click', collectCurrentProfile);
    document.getElementById('addToQueue').addEventListener('click', addCurrentProfileToQueue);
    document.getElementById('collectConnections').addEventListener('click', collectConnections);
    document.getElementById('collectSearchResults').addEventListener('click', collectSearchResults);
    document.getElementById('processQueue').addEventListener('click', processQueue);
    document.getElementById('clearQueue').addEventListener('click', clearQueue);
    document.getElementById('testConnection').addEventListener('click', testApiConnection);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
    document.getElementById('autoCollect').addEventListener('change', toggleAutoCollect);
  });
  
  // Initialize tabs
  function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked tab
        this.classList.add('active');
        
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Show content for active tab
        const tabId = this.getAttribute('data-tab') + '-tab';
        document.getElementById(tabId).classList.add('active');
      });
    });
  }
  
  // Load user settings from storage
  function loadSettings() {
    chrome.storage.sync.get({
      // Default settings
      apiUrl: '',
      apiKey: '',
      collectContactInfo: false,
      collectExperiences: true,
      collectEducation: true, 
      collectSkills: true,
      delay: 3,
      autoCollect: false
    }, function(items) {
      document.getElementById('apiUrl').value = items.apiUrl;
      document.getElementById('apiKey').value = items.apiKey;
      document.getElementById('collectContactInfo').checked = items.collectContactInfo;
      document.getElementById('collectExperiences').checked = items.collectExperiences;
      document.getElementById('collectEducation').checked = items.collectEducation;
      document.getElementById('collectSkills').checked = items.collectSkills;
      document.getElementById('delay').value = items.delay;
      document.getElementById('autoCollect').checked = items.autoCollect;
    });
  }
  
  // Load collection statistics
  function loadStats() {
    chrome.storage.local.get({
      profilesCollected: 0,
      todayCount: 0,
      queueCount: 0
    }, function(data) {
      document.getElementById('profilesCollected').textContent = data.profilesCollected;
      document.getElementById('todayCount').textContent = data.todayCount;
      document.getElementById('queueCount').textContent = data.queueCount;
    });
  }
  
  // Update the current profile display
  function updateCurrentProfile(profileData) {
    const profileElem = document.getElementById('currentProfile');
    const collectBtn = document.getElementById('collectProfile');
    const queueBtn = document.getElementById('addToQueue');
    
    if (profileData) {
      profileElem.textContent = `Current profile: ${profileData.name}`;
      
      // Show profile details
      document.getElementById('profileData').style.display = 'block';
      document.getElementById('profileName').textContent = profileData.name || 'N/A';
      document.getElementById('profileTitle').textContent = profileData.title || 'N/A';
      document.getElementById('profileCompany').textContent = profileData.company || 'N/A';
      
      // Enable buttons
      collectBtn.disabled = false;
      queueBtn.disabled = false;
    } else {
      profileElem.textContent = 'No LinkedIn profile detected';
      document.getElementById('profileData').style.display = 'none';
      collectBtn.disabled = true;
      queueBtn.disabled = true;
    }
  }
  
  // Collect the current profile
  function collectCurrentProfile() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "collectProfile",
        settings: getCollectionSettings()
      }, function(response) {
        if (response && response.success) {
          // Send to API
          sendProfileToApi(response.profileData);
          
          // Update UI
          showStatus("Profile collected successfully!", "success");
          updateStats(1, 0);
        } else {
          showStatus("Failed to collect profile", "error");
        }
      });
    });
  }
  
  // Add current profile to queue
  function addCurrentProfileToQueue() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "getProfileBasic"
      }, function(response) {
        if (response && response.profileData) {
          const profile = response.profileData;
          
          // Add to queue in storage
          chrome.storage.local.get({queue: []}, function(data) {
            // Check if already in queue
            const isDuplicate = data.queue.some(item => item.url === profile.url);
            
            if (!isDuplicate) {
              const newQueue = [...data.queue, profile];
              chrome.storage.local.set({queue: newQueue}, function() {
                updateQueueTable();
                updateStats(0, 1);
                showStatus("Added to queue", "success");
              });
            } else {
              showStatus("Profile already in queue", "error");
            }
          });
        } else {
          showStatus("Failed to get profile data", "error");
        }
      });
    });
  }
  
  // Update the queue table
  function updateQueueTable() {
    chrome.storage.local.get({queue: []}, function(data) {
      const tableBody = document.getElementById('queueTableBody');
      tableBody.innerHTML = '';
      
      if (data.queue.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" style="text-align: center;">Queue is empty</td>';
        tableBody.appendChild(row);
      } else {
        data.queue.forEach((profile, index) => {
          const row = document.createElement('tr');
          
          // Truncate URL for display
          const displayUrl = profile.url.length > 30 
            ? profile.url.substring(0, 30) + '...' 
            : profile.url;
          
          row.innerHTML = `
            <td>${profile.name || 'Unknown'}</td>
            <td><a href="${profile.url}" target="_blank">${displayUrl}</a></td>
            <td>
              <button class="secondary remove-btn" data-index="${index}" style="padding: 3px 8px;">✕</button>
            </td>
          `;
          tableBody.appendChild(row);
        });
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            removeFromQueue(index);
          });
        });
      }
    });
  }
  
  // Remove item from queue
  function removeFromQueue(index) {
    chrome.storage.local.get({queue: []}, function(data) {
      const newQueue = [...data.queue];
      newQueue.splice(index, 1);
      
      chrome.storage.local.set({queue: newQueue}, function() {
        updateQueueTable();
        updateStats(0, -1);
      });
    });
  }
  
  // Process all profiles in queue
  function processQueue() {
    chrome.storage.local.get({queue: []}, function(data) {
      if (data.queue.length === 0) {
        showStatus("Queue is empty", "error");
        return;
      }
      
      // Send message to background script to start processing
      chrome.runtime.sendMessage({
        action: "processQueue",
        settings: getCollectionSettings()
      });
      
      showStatus("Queue processing started in background", "success");
    });
  }
  
  // Clear the queue
  function clearQueue() {
    chrome.storage.local.set({queue: []}, function() {
      updateQueueTable();
      // Update the queue count to 0
      chrome.storage.local.get({queueCount: 0}, function(data) {
        chrome.storage.local.set({queueCount: 0});
        document.getElementById('queueCount').textContent = '0';
      });
      showStatus("Queue cleared", "success");
    });
  }
  
  // Collect all connections
  function collectConnections() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // First navigate to connections page if not already there
      if (!tabs[0].url.includes('linkedin.com/mynetwork/')) {
        chrome.tabs.update(tabs[0].id, {
          url: 'https://www.linkedin.com/mynetwork/invite-connect/connections/'
        }, function() {
          // Wait for page to load, then start collection
          setTimeout(() => {
            startConnectionCollection(tabs[0].id);
          }, 3000);
        });
      } else {
        startConnectionCollection(tabs[0].id);
      }
    });
  }
  
  // Start collecting connections
  function startConnectionCollection(tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: "collectConnections",
      settings: getCollectionSettings()
    }, function(response) {
      if (response && response.started) {
        showStatus("Collecting connections... This will run in the background", "success");
      } else {
        showStatus("Failed to start connection collection", "error");
      }
    });
  }
  
  // Collect search results
  function collectSearchResults() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Check if we're on a search results page
      if (!tabs[0].url.includes('linkedin.com/search/results/')) {
        showStatus("Please navigate to a LinkedIn search results page", "error");
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "collectSearchResults",
        settings: getCollectionSettings()
      }, function(response) {
        if (response && response.started) {
          showStatus("Collecting search results... This will run in the background", "success");
        } else {
          showStatus("Failed to start search results collection", "error");
        }
      });
    });
  }
  
  // Toggle auto-collect mode
  function toggleAutoCollect() {
    const enabled = document.getElementById('autoCollect').checked;
    
    // Save setting
    chrome.storage.sync.set({autoCollect: enabled}, function() {
      // Notify background script
      chrome.runtime.sendMessage({
        action: "toggleAutoCollect",
        enabled: enabled,
        settings: getCollectionSettings()
      });
      
      showStatus(enabled ? "Auto-collect enabled" : "Auto-collect disabled", 
                 enabled ? "success" : "info");
    });
  }
  
  // Test API connection
  function testApiConnection() {
    const apiUrl = document.getElementById('apiUrl').value;
    const apiKey = document.getElementById('apiKey').value;
    
    if (!apiUrl) {
      showStatus("Please enter API URL", "error");
      return;
    }
    
    showStatus("Testing connection...", "info");
    
    // Send test request to API
    fetch(`${apiUrl}/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey ? `Bearer ${apiKey}` : ''
      }
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error(`Status: ${response.status}`);
    })
    .then(data => {
      showStatus("Connection successful!", "success");
      chrome.storage.local.set({connectionStatus: 'connected'});
      updateConnectionStatus('connected');
    })
    .catch(error => {
      showStatus(`Connection failed: ${error.message}`, "error");
      chrome.storage.local.set({connectionStatus: 'disconnected'});
      updateConnectionStatus('disconnected');
    });
  }
  
  // Check and update connection status
  function checkConnectionStatus() {
    chrome.storage.local.get({connectionStatus: 'unknown'}, function(data) {
      updateConnectionStatus(data.connectionStatus);
    });
  }
  
  // Update connection status indicator
  function updateConnectionStatus(status) {
    const statusElem = document.getElementById('connectionStatus');
    
    switch (status) {
      case 'connected':
        statusElem.innerHTML = '⬤';
        statusElem.style.color = '#137333'; // green
        statusElem.title = 'Connected to API';
        break;
      case 'disconnected':
        statusElem.innerHTML = '⬤';
        statusElem.style.color = '#c5221f'; // red
        statusElem.title = 'Not connected to API';
        break;
      default:
        statusElem.innerHTML = '⬤';
        statusElem.style.color = '#666'; // gray
        statusElem.title = 'API connection status unknown';
    }
  }
  
  // Save settings
  function saveSettings() {
    const settings = {
      apiUrl: document.getElementById('apiUrl').value,
      apiKey: document.getElementById('apiKey').value,
      collectContactInfo: document.getElementById('collectContactInfo').checked,
      collectExperiences: document.getElementById('collectExperiences').checked,
      collectEducation: document.getElementById('collectEducation').checked,
      collectSkills: document.getElementById('collectSkills').checked,
      delay: parseInt(document.getElementById('delay').value) || 3,
      autoCollect: document.getElementById('autoCollect').checked
    };
    
    chrome.storage.sync.set(settings, function() {
      showStatus("Settings saved", "success");
      
      // Update auto-collect status if needed
      chrome.runtime.sendMessage({
        action: "toggleAutoCollect",
        enabled: settings.autoCollect,
        settings: settings
      });
    });
  }
  
  // Reset settings
  function resetSettings() {
    const defaultSettings = {
      apiUrl: '',
      apiKey: '',
      collectContactInfo: false,
      collectExperiences: true,
      collectEducation: true,
      collectSkills: true,
      delay: 3,
      autoCollect: false
    };
    
    chrome.storage.sync.set(defaultSettings, function() {
      // Load the default settings into the UI
      document.getElementById('apiUrl').value = defaultSettings.apiUrl;
      document.getElementById('apiKey').value = defaultSettings.apiKey;
      document.getElementById('collectContactInfo').checked = defaultSettings.collectContactInfo;
      document.getElementById('collectExperiences').checked = defaultSettings.collectExperiences;
      document.getElementById('collectEducation').checked = defaultSettings.collectEducation;
      document.getElementById('collectSkills').checked = defaultSettings.collectSkills;
      document.getElementById('delay').value = defaultSettings.delay;
      document.getElementById('autoCollect').checked = defaultSettings.autoCollect;
      
      // Turn off auto-collect
      chrome.runtime.sendMessage({
        action: "toggleAutoCollect",
        enabled: false
      });
      
      showStatus("Settings reset to defaults", "success");
    });
  }
  
  // Get current collection settings
  function getCollectionSettings() {
    return {
      collectContactInfo: document.getElementById('collectContactInfo').checked,
      collectExperiences: document.getElementById('collectExperiences').checked,
      collectEducation: document.getElementById('collectEducation').checked,
      collectSkills: document.getElementById('collectSkills').checked,
      delay: parseInt(document.getElementById('delay').value) || 3
    };
  }
  
  // Send profile data to API
  function sendProfileToApi(profileData) {
    chrome.storage.sync.get(['apiUrl', 'apiKey'], function(settings) {
      if (!settings.apiUrl) {
        console.log('API URL not configured, storing locally only');
        return;
      }
      
      fetch(`${settings.apiUrl}/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': settings.apiKey ? `Bearer ${settings.apiKey}` : ''
        },
        body: JSON.stringify(profileData)
      })
      .then(response => {
        if (response.ok) {
          console.log('Profile sent to API successfully');
          chrome.storage.local.set({connectionStatus: 'connected'});
          updateConnectionStatus('connected');
        } else {
          console.error('Failed to send profile to API: ' + response.status);
          chrome.storage.local.set({connectionStatus: 'disconnected'});
          updateConnectionStatus('disconnected');
        }
      })
      .catch(error => {
        console.error('API error: ' + error);
        chrome.storage.local.set({connectionStatus: 'disconnected'});
        updateConnectionStatus('disconnected');
      });
    });
  }
  
  // Update collection statistics
  function updateStats(profilesAdded, queueAdded) {
    chrome.storage.local.get({
      profilesCollected: 0,
      todayCount: 0,
      queueCount: 0
    }, function(data) {
      const newStats = {
        profilesCollected: data.profilesCollected + profilesAdded,
        todayCount: data.todayCount + profilesAdded,
        queueCount: data.queueCount + queueAdded
      };
      
      chrome.storage.local.set(newStats, function() {
        document.getElementById('profilesCollected').textContent = newStats.profilesCollected;
        document.getElementById('todayCount').textContent = newStats.todayCount;
        document.getElementById('queueCount').textContent = newStats.queueCount;
      });
    });
  }
  
  // Show status message
  function showStatus(message, type) {
    const statusElem = document.getElementById('statusMessage');
    statusElem.textContent = message;
    statusElem.className = type || 'info';
    statusElem.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusElem.style.display = 'none';
    }, 3000);
  }