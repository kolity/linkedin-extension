# Installation & Setup Guide

## Complete Installation Process

### Step 1: Download the Extension
1. Download all the files in this package
2. Extract the ZIP file to a folder on your computer

### Step 2: Install in Chrome
1. Open Chrome browser
2. Navigate to `chrome://extensions/` (type this in your address bar)
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" button 
5. Select the folder containing the extension files
6. The LinkedIn Data Collector extension should now appear in your extensions list

### Step 3: Set Up Backend API (Optional)
If you want to store data in your own database:

1. Navigate to the `backend-api` folder
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your PostGreSql connection string:
   ```
   PORT=3000
    DATABASE_URL="postgresql://postgres:password@localhost:5432/linkedindb"
    NODE_ENV=development
   ```
4. Start the server:
   ```
   npm start
   ```
5. The API will be available at `http://localhost:3000`

### Step 4: Configure the Extension
1. Click on the extension icon in your browser toolbar
2. Go to the "Settings" tab
3. Enter your backend API URL (e.g., `http://localhost:3000`)
4. Click "Test Connection" to verify the connection
5. Adjust collection settings according to your needs:
   - Toggle which data to collect (experiences, education, skills, contact info)
   - Set the delay between requests
   - Enable/disable auto-collection
6. Click "Save Settings" to apply changes

## Security Best Practices

1. **Rate Limiting**: The extension includes built-in delays to avoid hitting LinkedIn's rate limits and potentially getting your account flagged. The default delay (3 seconds) is usually safe, but you can increase it for extra caution.

2. **API Key Security**: If you implement authentication for your API, keep your API key secure and do not share it.

3. **Data Privacy**: Ensure that your usage of the collected data complies with relevant privacy regulations (GDPR, CCPA, etc.).

4. **LinkedIn Terms of Service**: Be aware that automated data collection may violate LinkedIn's Terms of Service in some cases. This extension is designed for personal use and research purposes only.

## Troubleshooting

### Extension Not Working
- **Issue**: LinkedIn not detected
  - **Solution**: Make sure you're on a LinkedIn page. The extension only activates on linkedin.com domains.

- **Issue**: Profile data not being detected
  - **Solution**: LinkedIn sometimes changes their page structure. You may need to update the selectors in `content.js`.

- **Issue**: Collection fails
  - **Solution**: Try increasing the delay between requests in the settings.

### Backend API Issues
- **Issue**: Connection test fails
  - **Solution**: Ensure your API server is running and the URL is correct. Check for CORS issues.

- **Issue**: MongoDB connection errors
  - **Solution**: Verify your MongoDB connection string and make sure MongoDB is running.

### Browser Issues
- **Issue**: Extension not loading
  - **Solution**: Try refreshing the extensions page (`chrome://extensions/`) or reinstalling the extension.

- **Issue**: Browser performance issues
  - **Solution**: The queue processing can be resource-intensive. Try reducing the number of profiles in the queue.

## Contact & Support

For issues, questions, or feature requests, please:
1. Check the README and this installation guide
2. Examine the code documentation
3. Contact the developer through the repository's issue tracker
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://*.linkedin.com/*"],
      "js": ["content.js"]
    }
  ],
  "icons": {
    "16": "images/icon16.png",
    "48": "images/icon48.png",
    "128": "images/icon128.png"
  }
}
