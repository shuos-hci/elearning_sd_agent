/* Frontend configuration — the ONLY place the backend URL is set.
   Leave API_BASE_URL empty to run fully offline (events are queued in localStorage).
   After deploying the backend (see backend/README.md), set e.g.:
     API_BASE_URL: 'https://wasa4-analytics.onrender.com'
   No secrets or API keys ever go in this file. */
window.APP_CONFIG = {
  API_BASE_URL: '',
};
