// --------------------------------------------------
// File: api.js
// --------------------------------------------------
// API client for communicating with the backend

class LinkedInAPI {
    constructor(baseUrl, apiKey) {
      this.baseUrl = baseUrl;
      this.apiKey = apiKey;
    }
    
    async testConnection() {
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
    
    async saveProfile(profileData) {
      try {
        const response = await fetch(`${this.baseUrl}/profiles`, {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify(profileData)
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error saving profile:', error);
        throw error;
      }
    }
    
    async bulkSaveProfiles(profiles) {
      try {
        const response = await fetch(`${this.baseUrl}/profiles/bulk`, {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify({ profiles })
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error bulk saving profiles:', error);
        throw error;
      }
    }
    
    async getStats() {
      try {
        const response = await fetch(`${this.baseUrl}/stats`, {
          method: 'GET',
          headers: this._getHeaders()
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching stats:', error);
        return null;
      }
    }
    
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
  
  // Export for use in other scripts
  window.LinkedInAPI = LinkedInAPI;
  