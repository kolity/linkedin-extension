// --------------------------------------------------
// File: api.js
// --------------------------------------------------
// API client for communicating with the backend

class LinkedInAPI {
    constructor(baseUrl, apiKey) {
      this.baseUrl = baseUrl;
      this.apiKey = apiKey;
      this.isInitialized = !!baseUrl;
    }
    
    /**
     * Test connection to the backend API
     * @returns {Promise<boolean>} True if connection is successful
     */
    async testConnection() {
      if (!this.isInitialized) {
        console.error('API client not initialized with valid baseUrl');
        return false;
      }
      
      try {
        const response = await fetch(`${this.baseUrl}/ping`, {
          method: 'GET',
          headers: this._getHeaders()
        });
        
        return response.ok;
      } catch (error) {
        console.error('API connection test failed:', error);
        return false;
      }
    }
    
    /**
     * Save a single LinkedIn profile
     * @param {Object} profileData LinkedIn profile data
     * @returns {Promise<Object>} Response from the API
     */
    async saveProfile(profileData) {
      if (!this.isInitialized) {
        throw new Error('API client not initialized with valid baseUrl');
      }
      
      try {
        const response = await fetch(`${this.baseUrl}/profiles`, {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify(profileData)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server responded with status: ${response.status}. ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error saving profile:', error);
        throw error;
      }
    }
    
    /**
     * Save multiple LinkedIn profiles in bulk
     * @param {Array<Object>} profiles Array of LinkedIn profile data objects
     * @returns {Promise<Object>} Response from the API
     */
    async bulkSaveProfiles(profiles) {
      if (!this.isInitialized) {
        throw new Error('API client not initialized with valid baseUrl');
      }
      
      if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
        throw new Error('Invalid profiles data. Must be a non-empty array.');
      }
      
      try {
        const response = await fetch(`${this.baseUrl}/profiles/bulk`, {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify({ profiles })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server responded with status: ${response.status}. ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error bulk saving profiles:', error);
        throw error;
      }
    }
    
    /**
     * Get collection statistics
     * @returns {Promise<Object|null>} Statistics or null if error occurs
     */
    async getStats() {
      if (!this.isInitialized) {
        console.error('API client not initialized with valid baseUrl');
        return null;
      }
      
      try {
        const response = await fetch(`${this.baseUrl}/stats`, {
          method: 'GET',
          headers: this._getHeaders()
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Server responded with status: ${response.status}. ${errorText}`);
          return null;
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching stats:', error);
        return null;
      }
    }
    
    /**
     * Get all saved profiles
     * @param {number} limit Maximum number of profiles to return
     * @param {number} offset Number of profiles to skip
     * @returns {Promise<Object|null>} Profiles data or null if error occurs
     */
    async getProfiles(limit = 100, offset = 0) {
      if (!this.isInitialized) {
        console.error('API client not initialized with valid baseUrl');
        return null;
      }
      
      try {
        const url = new URL(`${this.baseUrl}/profiles`);
        url.searchParams.append('limit', limit);
        url.searchParams.append('offset', offset);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: this._getHeaders()
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Server responded with status: ${response.status}. ${errorText}`);
          return null;
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching profiles:', error);
        return null;
      }
    }
    
    /**
     * Generate request headers
     * @private
     * @returns {Object} Headers object
     */
    _getHeaders() {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      
      return headers;
    }
  }
  
  // Create a global singleton instance for use throughout the extension
  if (typeof window !== 'undefined') {
    // Check if API client already exists to prevent overwriting
    if (!window.linkedInAPI) {
      window.linkedInAPI = {
        // Instance will be initialized later with proper baseUrl
        instance: null,
        
        /**
         * Initialize the API client
         * @param {string} baseUrl API base URL
         * @param {string} apiKey Optional API key
         * @returns {LinkedInAPI} The API client instance
         */
        initialize: function(baseUrl, apiKey) {
          if (!baseUrl) {
            console.error('Cannot initialize API client without baseUrl');
            return null;
          }
          
          this.instance = new LinkedInAPI(baseUrl, apiKey);
          return this.instance;
        },
        
        /**
         * Get the API client instance
         * @returns {LinkedInAPI|null} The API client instance or null if not initialized
         */
        getInstance: function() {
          return this.instance;
        },
        
        /**
         * Test if the API client can connect to the backend
         * @returns {Promise<boolean>} True if connection is successful
         */
        testConnection: async function() {
          if (!this.instance) {
            console.error('API client not initialized. Call initialize() first.');
            return false;
          }
          
          return await this.instance.testConnection();
        }
      };
      
      console.log('LinkedIn API client initialized');
    }
  }
  
  // For backward compatibility with existing code
  if (typeof window !== 'undefined') {
    window.LinkedInAPI = LinkedInAPI;
  }
  
  // For CommonJS environments (Node.js)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LinkedInAPI };
  }