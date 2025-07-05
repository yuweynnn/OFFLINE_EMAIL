class YuenDispoMail {
  constructor() {
      this.currentEmail = null;
      this.emails = [];
      this.autoRefreshInterval = null;
      this.domains = [
          'guerrillamail.com', 
          'harakirimail.com',
          'guerrillamail.org',
          'guerrillamail.biz',
          'guerrillamailblock.com',
              'guerrillamail.de',
              'grr.la',
              'guerrillamail.net',
              'sharklasers.com',
              'guerrillamail.info',
      ];
      this.lastEmailCount = 0;
      this.apiKeys = {
          mailslurp: localStorage.getItem('mailslurp_api_key') || ''
      };
      this.mailslurpInboxes = new Map();
      this.isOffline = !navigator.onLine;
      this.offlineIndicator = null;

      this.init();
  }

  init() {
      this.setupDomainSelect();
      this.setupEventListeners();
      this.setupModal();
      this.setupAutoRefresh();
      this.applyTheme();
      this.requestNotificationPermission();
      this.setupOfflineHandling();
      this.loadCachedData();
  }

  async requestNotificationPermission() {
      if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
      }
  }

  setupOfflineHandling() {
      // Handle online/offline events
      window.addEventListener('online', () => {
          this.isOffline = false;
          this.hideOfflineIndicator();
          this.showNotification('Connection restored! Syncing emails...', 'success');
          if (this.currentEmail) {
              this.refreshEmails();
          }
      });

      window.addEventListener('offline', () => {
          this.isOffline = true;
          this.showOfflineIndicator();
          this.showNotification('You are offline. Cached emails are still available.', 'warning');
      });

      // Show offline indicator if starting offline
      if (this.isOffline) {
          this.showOfflineIndicator();
      }
  }

  showOfflineIndicator() {
      if (this.offlineIndicator) return;
      
      this.offlineIndicator = document.createElement('div');
      this.offlineIndicator.className = 'offline-indicator';
      this.offlineIndicator.innerHTML = '📡 Offline Mode - Using cached data';
      document.body.appendChild(this.offlineIndicator);
  }

  hideOfflineIndicator() {
      if (this.offlineIndicator) {
          this.offlineIndicator.remove();
          this.offlineIndicator = null;
      }
  }

  saveToCache(key, data) {
      try {
          localStorage.setItem(`yuen_dispo_${key}`, JSON.stringify(data));
      } catch (error) {
          console.error('Failed to save to cache:', error);
      }
  }

  loadFromCache(key) {
      try {
          const data = localStorage.getItem(`yuen_dispo_${key}`);
          return data ? JSON.parse(data) : null;
      } catch (error) {
          console.error('Failed to load from cache:', error);
          return null;
      }
  }

  loadCachedData() {
      // Load cached current email
      const cachedEmail = this.loadFromCache('current_email');
      if (cachedEmail) {
          this.currentEmail = cachedEmail;
          this.displayCurrentEmail(cachedEmail);
      }

      // Load cached emails
      const cachedEmails = this.loadFromCache('emails');
      if (cachedEmails && cachedEmails.length > 0) {
          this.emails = cachedEmails.map(email => ({
              ...email,
              time: new Date(email.time) // Convert time back to Date object
          }));
          this.lastEmailCount = this.emails.length;
          this.displayEmails();
          
          if (this.isOffline) {
              this.showNotification(`Loaded ${this.emails.length} cached emails`, 'info');
          }
      }
  }

  setupDomainSelect() {
      const domainSelect = document.getElementById('domainSelect');
      if (!domainSelect) {
          console.error('Domain select element not found');
          return;
      }

      // Clear existing options first
      domainSelect.innerHTML = '';
      
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select Domain';
      domainSelect.appendChild(defaultOption);

      // Add domain options
      this.domains.forEach(domain => {
          const option = document.createElement('option');
          option.value = domain;
          option.textContent = `@${domain}`;
          domainSelect.appendChild(option);
      });

      console.log('Domain select populated with:', this.domains);
      console.log('Domain select options count:', domainSelect.children.length);
  }

  setupEventListeners() {
      document.getElementById('generateBtn').addEventListener('click', () => {
          this.generateEmail();
      });

      document.getElementById('refreshBtn').addEventListener('click', () => {
          this.refreshEmails();
      });

      document.getElementById('searchBtn').addEventListener('click', () => {
          this.searchEmail();
      });

      document.getElementById('copyBtn')?.addEventListener('click', () => {
          this.copyEmail();
      });

      document.getElementById('darkModeToggle').addEventListener('click', () => {
          this.toggleTheme();
      });

      document.getElementById('autoRefresh').addEventListener('change', (e) => {
          this.toggleAutoRefresh(e.target.checked);
      });
  }

  setupModal() {
      const modal = document.getElementById('emailModal');
      const closeBtn = modal.querySelector('.close');

      closeBtn.addEventListener('click', () => {
          this.closeModal();
      });

      window.addEventListener('click', (e) => {
          if (e.target === modal) {
              this.closeModal();
          }
      });
  }

  setupAutoRefresh() {
      // Auto refresh setup
  }

  applyTheme() {
      const isDark = localStorage.getItem('darkMode') === 'true';
      if (isDark) {
          document.body.classList.add('dark-mode');
          document.body.setAttribute('data-theme', 'dark');
      } else {
          document.body.classList.remove('dark-mode');
          document.body.setAttribute('data-theme', 'light');
      }

      // Update toggle icon
      const toggleIcon = document.querySelector('#darkModeToggle i');
      if (toggleIcon) {
          toggleIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
      }
  }

  toggleTheme() {
      const isDark = document.body.classList.contains('dark-mode');

      if (isDark) {
          document.body.classList.remove('dark-mode');
          document.body.setAttribute('data-theme', 'light');
      } else {
          document.body.classList.add('dark-mode');
          document.body.setAttribute('data-theme', 'dark');
      }

      localStorage.setItem('darkMode', !isDark);

      // Update toggle icon
      const toggleIcon = document.querySelector('#darkModeToggle i');
      if (toggleIcon) {
          toggleIcon.className = !isDark ? 'fas fa-sun' : 'fas fa-moon';
      }

      // Show notification
      this.showNotification(`Switched to ${!isDark ? 'dark' : 'light'} mode`, 'info');
  }

  toggleAutoRefresh(enabled) {
      if (this.autoRefreshInterval) {
          clearInterval(this.autoRefreshInterval);
          this.autoRefreshInterval = null;
      }

      if (enabled && this.currentEmail) {
          this.autoRefreshInterval = setInterval(() => {
              this.refreshEmails();
          }, 10000); // 10 seconds to reduce API calls
      }
  }

  async generateEmail() {
      const domainSelect = document.getElementById('domainSelect');
      const selectedDomain = domainSelect.value;

      if (!selectedDomain) {
          this.showNotification('Please select a domain first', 'error');
          return;
      }

      try {
          const username = this.generateRandomUsername();
          let email = `${username}@${selectedDomain}`;

          // Original logic for all services
          await this.preRegisterEmail(username, selectedDomain);
          this.currentEmail = email;
          this.displayCurrentEmail(email);
          this.showNotification(`Generated and registered email: ${email}`, 'success');
          this.emails = [];
          this.lastEmailCount = 0;

          setTimeout(() => {
              this.refreshEmails();
          }, 2000);

          // Enable auto-refresh automatically
          document.getElementById('autoRefresh').checked = true;
          this.toggleAutoRefresh(true);
      } catch (error) {
          console.error('Error generating email:', error);
          this.showNotification('Error generating email', 'error');
      }
  }

  async preRegisterEmail(username, domain) {
      try {
          if (domain === 'guerrillamail.com') {
              // Register with Guerrilla Mail
              await fetch(`https://corsproxy.io/?https://www.guerrillamail.com/ajax.php?f=set_email_user&email_user=${username}&lang=en&site=guerrillamail.com`);
          } else if (domain === 'harakirimail.com') {
              // For 1secmail-based services, just check if username exists
              await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=${domain}`);
          }
      } catch (error) {
          console.log('Pre-registration attempt completed for', username, domain);
      }
  }

  generateRandomUsername() {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
  }

  displayCurrentEmail(email) {
      const currentEmailDiv = document.getElementById('currentEmailDiv');
      const currentEmailSpan = document.getElementById('currentEmail');

      currentEmailSpan.textContent = email;
      currentEmailDiv.style.display = 'block';
  }

  async searchEmail() {
      const searchEmail = document.getElementById('searchEmail').value.trim();
      if (!searchEmail || !searchEmail.includes('@')) {
          this.showNotification('Please enter a valid email address', 'error');
          return;
      }

      this.currentEmail = searchEmail;
      this.displayCurrentEmail(searchEmail);
      this.emails = [];
      this.lastEmailCount = 0;
      this.refreshEmails();
      this.showNotification(`Accessing inbox for: ${searchEmail}`, 'info');
  }

  async refreshEmails() {
      if (!this.currentEmail) {
          this.showNotification('No email generated yet', 'warning');
          return;
      }

      console.log(`Attempting to fetch emails for ${this.currentEmail}`);

      // If offline, show cached emails
      if (this.isOffline) {
          this.showNotification('Offline: Showing cached emails', 'info');
          this.displayEmails();
          return;
      }

      try {
          const domain = this.currentEmail.split('@')[1];
          const username = this.currentEmail.split('@')[0];

          let emails = [];

          if (domain === 'guerrillamail.com' || domain === 'guerrillamail.de' || domain === 'grr.la' || domain === 'guerrillamail.net' || domain === 'sharklasers.com') {
              emails = await this.fetchGuerrillaEmails(username, domain);
          } else if (domain === 'harakirimail.com') {
              emails = await this.fetchHarakiriEmails(username);
          }

          // Auto-detect verification codes for HarakiriMail
          if (this.currentEmail.includes('harakirimail.com')) {
              await this.fetchHarakiriCodesDirectly(this.currentEmail);
          }

          // Auto-detect new emails
          if (emails.length > this.lastEmailCount) {
              const newEmails = emails.slice(this.lastEmailCount);
              newEmails.forEach(email => {
                  this.showEmailPopup(email);
                  this.showBrowserNotification(email, this.extractVerificationCodes(email.content + ' ' + email.subject));
              });
              this.showNotification(`${newEmails.length} new email(s) received!`, 'success');
          }

          this.emails = emails;
          this.lastEmailCount = emails.length;
          
          // Cache the emails for offline use
          this.saveToCache('emails', this.emails);
          this.saveToCache('current_email', this.currentEmail);
          this.saveToCache('last_update', new Date().toISOString());
          
          this.displayEmails();

      } catch (error) {
          console.error('Error fetching emails:', error);
          
          // If network error and we have cached emails, show them
          if (this.emails.length > 0) {
              this.showNotification('Network error: Showing cached emails', 'warning');
              this.displayEmails();
          } else {
              this.showNotification('Error fetching emails and no cached data available', 'error');
          }
      }
  }

  async fetchGuerrillaEmails(username, domain) {
      try {
          // Use direct CORS proxy approach
          const response = await fetch(`https://corsproxy.io/?https://www.guerrillamail.com/ajax.php?f=set_email_user&email_user=${username}&lang=en&site=guerrillamail.com`);
          const data = await response.json();

          if (data.sid_token) {
              // Get email list
              const listResponse = await fetch(`https://corsproxy.io/?https://www.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${data.sid_token}`);
              const listData = await listResponse.json();

              if (listData && listData.list) {
                  return listData.list.map((email, index) => ({
                      id: `guerrilla_${index}`,
                      from: email.mail_from || 'Unknown',
                      subject: email.mail_subject || 'No Subject',
                      content: email.mail_excerpt || email.mail_body || 'Click to view content',
                      time: new Date(email.mail_timestamp * 1000),
                      read: false
                  }));
              }
          }
          return [];
      } catch (error) {
          console.error('Guerrilla Mail fetch error:', error);
          return [];
      }
  }



  async fetchGetNadaEmails(username) {
      try {
          console.log(`Fetching GetNada emails for ${username}`);

          // GetNada works with direct API calls
          const endpoints = [
              `https://getnada.com/api/v1/inboxes/${username}`,
              `https://corsproxy.io/?https://getnada.com/api/v1/inboxes/${username}`,
              `https://api.allorigins.win/get?url=${encodeURIComponent(`https://getnada.com/api/v1/inboxes/${username}`)}`
          ];

          for (const endpoint of endpoints) {
              try {
                  const response = await fetch(endpoint);
                  if (response.ok) {
                      let data = await response.json();

                      // Handle allorigins wrapper
                      if (data.contents) {
                          data = JSON.parse(data.contents);
                      }

                      if (data.msgs && Array.isArray(data.msgs)) {
                          return data.msgs.map((email, index) => ({
                              id: `getnada_${email.uid || index}_${Date.now()}`,
                              from: email.f || 'GetNada Sender',
                              subject: email.s || 'GetNada Message',
                              content: email.b || email.html || 'Email content',
                              time: new Date(email.t * 1000 || Date.now()),
                              read: false
                          }));
                      }
                  }
              } catch (e) {
                  continue;
              }
          }
          return [];
      } catch (error) {
          console.log('GetNada service - no emails received yet');
          return [];
      }
  }



  async fetchHarakiriEmails(username) {
      try {
          console.log(`Fetching HarakiriMail emails for ${username}`);

          // Multiple working endpoints for harakirimail
          const endpoints = [
              `https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=harakirimail.com`,
              `https://corsproxy.io/?https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=harakirimail.com`,
              `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=harakirimail.com`)}`,
              `https://thingproxy.freeboard.io/fetch/https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=harakirimail.com`,
              `https://proxy.cors.sh/https://www.1secmail.com/api/v1/?action=getMessages&login=${username}&domain=harakirimail.com`
          ];

          for (const endpoint of endpoints) {
              try {
                  const response = await fetch(endpoint, {
                      method: 'GET',
                      headers: {
                          'Accept': 'application/json, text/plain, */*',
                          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                          'Cache-Control': 'no-cache'
                      }
                  });

                  if (response.ok) {
                      let data = await response.text();

                      try {
                          const jsonData = JSON.parse(data);
                          if (Array.isArray(jsonData) && jsonData.length > 0) {
                              console.log(`HarakiriMail success! Found ${jsonData.length} emails from ${endpoint}`);
                              return await this.processSecMailEmails(jsonData, username, 'harakirimail.com');
                          } else if (Array.isArray(jsonData)) {
                              console.log(`HarakiriMail active, no emails yet from ${endpoint}`);
                              return [];
                          }
                      } catch (parseError) {
                          // Try to extract emails from HTML if JSON parsing fails
                          if (data.includes('@') || data.includes('subject') || data.includes('from')) {
                              const parsedEmails = this.parseEmailsFromHTML(data, 'harakirimail');
                              if (parsedEmails.length > 0) {
                                  console.log(`HarakiriMail HTML parsing success! Found ${parsedEmails.length} emails`);
                                  return parsedEmails;
                              }
                          }
                      }
                  }
              } catch (error) {
                  console.log(`HarakiriMail endpoint failed: ${endpoint}`, error.message);
                  continue;
              }
          }

          console.log('HarakiriMail service monitoring - no emails received yet');
          return [];

      } catch (error) {
          console.log('HarakiriMail service monitoring - no emails received yet');
          return [];
      }
  }



  async processSecMailEmails(data, username, domain) {
      const processedEmails = [];

      for (const email of data) {
          try {
              // Try to get full content
              const contentEndpoints = [
                  `https://www.1secmail.com/api/v1/?action=readMessage&login=${username}&domain=${domain}&id=${email.id}`,
                  `https://1secmail.com/api/v1/?action=readMessage&login=${username}&domain=${domain}&id=${email.id}`
              ];

              let fullContent = email.subject || 'Email received';

              for (const endpoint of contentEndpoints) {
                  try {
                      const contentResponse = await fetch(endpoint);
                      if (contentResponse.ok) {
                          const fullEmail = await contentResponse.json();
                          fullContent = fullEmail.textBody || fullEmail.htmlBody || fullEmail.body || fullContent;
                          break;
                      }
                  } catch (e) {
                      continue;
                  }
              }

              processedEmails.push({
                  id: `${domain.split('.')[0]}_${email.id}_${Date.now()}`,
                  from: email.from || 'Service Sender',
                  subject: email.subject || 'Service Message',
                  content: fullContent,
                  time: new Date(email.date || Date.now()),
                  read: false
              });
          } catch (error) {
              processedEmails.push({
                  id: `${domain.split('.')[0]}_${email.id}_${Date.now()}`,
                  from: email.from || 'Service Sender',
                  subject: email.subject || 'Service Message',
                  content: email.subject || 'Email received',
                  time: new Date(email.date || Date.now()),
                  read: false
              });
          }
      }

      return processedEmails;
  }

  createDemoEmails(username, domain) {
      return [
          {
              id: `demo_${domain}_${Date.now()}`,
              from: `service@${domain}`,
              subject: `${domain} Service Active`,
              content: `${domain} inbox for ${username} is being monitored. Real emails will appear here when received. The service is working properly.`,
              time: new Date(),
              read: false
          }
      ];
  }

  extractFrom(text) {
      const patterns = [
          /from[:\s]+([^\n@]+@[^\n\s]+)/i,
          /([^\n@]+@[^\n\s]+)/,
          /sender[:\s]+([^\n]+)/i
      ];

      for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
              return match[1].trim();
          }
      }
      return null;
  }

  extractSubject(text) {
      const patterns = [
          /subject[:\s]+([^\n]+)/i,
          /title[:\s]+([^\n]+)/i,
          /^([^\n@]{5,50})/
      ];

      for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
              const subject = match[1].trim();
              if (subject.length > 3 && subject.length < 100) {
                  return subject;
              }
          }
      }
      return null;
  }

  parseEmailsFromHTML(html, prefix) {
      try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const emails = [];

          // Enhanced HTML parsing patterns for different email services
          const emailSelectors = [
              // YopMail specific
              'tr[onclick*="readmail"]',
              '.mail',
              '.lm',
              '#mailmenu tr',
              // Generic email patterns
              '.email-item',
              '.message',
              '.mail-item',
              '.inbox-item',
              '.email-row',
              '[data-mail-id]',
              'tr[data-mail]',
              'div[id*="mail"]',
              'li[data-message]'
          ];

          emailSelectors.forEach(selector => {
              try {
                  const elements = doc.querySelectorAll(selector);
                  elements.forEach((element, index) => {
                      const text = element.textContent.trim();
                      if (text.length > 15 && (text.includes('@') || text.includes('Subject:') || text.includes('From:'))) {
                          const emailData = this.extractEmailDataFromElement(element, text, index, prefix);
                          if (emailData) {
                              emails.push(emailData);
                          }
                      }
                  });
              } catch (e) {
                  console.log(`Error parsing selector ${selector}:`, e.message);
              }
          });

          // If no structured emails found, try to parse raw text
          if (emails.length === 0) {
              const bodyText = doc.body ? doc.body.textContent : html;
              const textEmails = this.parseEmailsFromText(bodyText, prefix);
              emails.push(...textEmails);
          }

          return emails.slice(0, 10); // Limit to 10 emails max
      } catch (error) {
          console.error('HTML parsing error:', error);
          return [];
      }
  }

  extractEmailDataFromElement(element, text, index, prefix) {
      try {
          // Try to extract structured email data
          const fromMatch = text.match(/(?:from|sender)[:\s]+([^\n@]+@[^\n\s]+)/i) || 
                           text.match(/([^\n@]+@[^\n\s]+)/);
          const subjectMatch = text.match(/(?:subject|title)[:\s]+([^\n]+)/i) ||
                              text.match(/^([^\n@]{10,80})/);

          const from = fromMatch ? fromMatch[1].trim() : `${prefix}-sender@example.com`;
          const subject = subjectMatch ? subjectMatch[1].trim() : `${prefix} message #${index + 1}`;

          // Extract date if available
          const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/i);
          const emailDate = dateMatch ? new Date(dateMatch[0]) : new Date();

          return {
              id: `${prefix}_parsed_${index}_${Date.now()}`,
              from: from.substring(0, 50), // Limit length
              subject: subject.substring(0, 100), // Limit length
              content: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
              time: emailDate,
              read: false
          };
      } catch (error) {
          return null;
      }
  }

  parseEmailsFromText(text, prefix) {
      const emails = [];

      // Look for email patterns in raw text
      const emailPatterns = [
          /(?:from|sender)[:\s]+([^\n@]+@[^\n\s]+)[^\n]*(?:\n|$)([^\n]*)/gi,
          /([^\n@]+@[^\n\s]+)[^\n]*(?:\n|$)([^\n]*)/gi
      ];

      emailPatterns.forEach((pattern, patternIndex) => {
          let match;
          let matchCount = 0;
          while ((match = pattern.exec(text)) !== null && matchCount < 5) {
              const from = match[1].trim();
              const preview = match[2] ? match[2].trim() : 'Email content preview';

              if (from.length > 5 && from.includes('@')) {
                  emails.push({
                      id: `${prefix}_text_${patternIndex}_${matchCount}_${Date.now()}`,
                      from: from,
                      subject: preview.substring(0, 50) || `Text email #${matchCount + 1}`,
                      content: preview.substring(0, 150) + (preview.length > 150 ? '...' : ''),
                      time: new Date(),
                      read: false
                  });
                  matchCount++;
              }
          }
      });

      return emails;
  }



  async fetchHarakiriCodesDirectly(email) {
      try {
          const [login] = email.split('@');

          // Try multiple approaches to get HarakiriMail inbox
          const approaches = [
              `https://harakirimail.com/inbox/${login}`,
              `https://harakirimail.com/${login}`,
              `https://harakirimail.com/check/${login}`
          ];

          for (const url of approaches) {
              try {
                  // Use a CORS proxy service
                  const proxyResponse = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`);

                  if (proxyResponse.ok) {
                      const html = await proxyResponse.text();

                      // Extract verification codes from HTML
                      const codes = this.extractVerificationCodes(html);

                      if (codes.length > 0) {
                          // Create a synthetic email with the codes
                          const codeEmail = {
                              id: `harakiri_codes_${Date.now()}`,
                              from: 'Auto-detected',
                              subject: 'Verification Codes Found',
                              content: `Codes detected: ${codes.join(', ')}`,
                              time: new Date(),
                              read: false
                          };

                          this.showEmailPopup(codeEmail);
                          break;
                      }
                  }
              } catch (proxyError) {
                  continue; // Try next approach
              }
          }
      } catch (error) {
          console.error('HarakiriMail direct fetch error:', error);
      }
  }

  async fetchMailSlurpEmails(username) {
      try {
          console.log(`Fetching MailSlurp emails for ${username}`);

          if (!this.apiKeys.mailslurp) {
              this.showNotification('MailSlurp requires API key. Please check documentation.', 'warning');
              return [];
          }

          // Check if we have an existing inbox for this username
          let inboxId = this.mailslurpInboxes.get(username);

          if (!inboxId) {
              // Create a new inbox
              const createResponse = await fetch('https://api.mailslurp.com/inboxes', {
                  method: 'POST',
                  headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                      'x-api-key': this.apiKeys.mailslurp
                  },
                  body: JSON.stringify({
                      name: username,
                      description: `Inbox for ${username}`
                  })
              });

              if (createResponse.ok) {
                  const inboxData = await createResponse.json();
                  inboxId = inboxData.id;
                  this.mailslurpInboxes.set(username, inboxId);
                  console.log(`Created MailSlurp inbox: ${inboxData.emailAddress}`);

                  // Update current email display with the actual MailSlurp address
                  this.currentEmail = inboxData.emailAddress;
                  this.displayCurrentEmail(inboxData.emailAddress);
              } else {
                  console.error('Failed to create MailSlurp inbox:', createResponse.status);
                  if (createResponse.status === 401) {
                      this.showNotification('Invalid MailSlurp API key', 'error');
                      localStorage.removeItem('mailslurp_api_key');
                      this.apiKeys.mailslurp = '';
                  }
                  return [];
              }
          }

          // Fetch emails for the inbox
          const emailsResponse = await fetch(`https://api.mailslurp.com/inboxes/${inboxId}/emails`, {
              method: 'GET',
              headers: {
                  'Accept': 'application/json',
                  'x-api-key': this.apiKeys.mailslurp
              }
          });

          if (emailsResponse.ok) {
              const emailsData = await emailsResponse.json();
              console.log(`MailSlurp found ${emailsData.content ? emailsData.content.length : 0} emails`);

              if (emailsData.content && emailsData.content.length > 0) {
                  const processedEmails = [];

                  for (const email of emailsData.content) {
                      try {
                          // Fetch full email content
                          const fullEmailResponse = await fetch(`https://api.mailslurp.com/emails/${email.id}`, {
                              headers: {
                                  'Accept': 'application/json',
                                  'x-api-key': this.apiKeys.mailslurp
                              }
                          });

                          let content = email.subject || 'MailSlurp email';
                          if (fullEmailResponse.ok) {
                              const fullEmailData = await fullEmailResponse.json();
                              content = fullEmailData.body || fullEmailData.textExcerpt || content;
                          }

                          processedEmails.push({
                              id: `mailslurp_${email.id}_${Date.now()}`,
                              from: email.from || 'MailSlurp Sender',
                              subject: email.subject || 'MailSlurp Message',
                              content: content,
                              time: new Date(email.createdAt || Date.now()),
                              read: false
                          });
                      } catch (error) {
                          console.error('Error processing MailSlurp email:', error);
                      }
                  }

                  return processedEmails;
              }

              console.log('MailSlurp service active, no emails yet');
              return [];
          } else {
              console.error('MailSlurp emails fetch error:', emailsResponse.status);
              return [];
          }
      } catch (error) {
          console.error('MailSlurp fetch error:', error);
          return [];
      }
  }

  displayEmails() {
      const emailList = document.getElementById('emailList');

      if (this.emails.length === 0) {
          emailList.innerHTML = '<div class="no-emails">No emails found. Emails may take a few minutes to appear.</div>';
          return;
      }

      emailList.innerHTML = this.emails.map(email => `
          <div class="email-item ${email.read ? 'read' : 'unread'}" onclick="window.yuenDispoMail.openEmail('${email.id}')">
              <div class="email-header">
                  <span class="email-from">${email.from}</span>
                  <span class="email-time">${this.formatTime(email.time)}</span>
              </div>
              <div class="email-subject">${email.subject}</div>
              <div class="email-preview">${email.content.substring(0, 100)}...</div>
          </div>
      `).join('');
  }

  openEmail(emailId) {
      const email = this.emails.find(e => e.id === emailId);
      if (!email) return;

      email.read = true;
      this.displayEmails();

      const modal = document.getElementById('emailModal');
      const content = document.getElementById('emailContent');

      const codes = this.extractVerificationCodes(email.content + ' ' + email.subject);
      const codesHtml = codes.length > 0 ? `
          <div class="verification-codes">
              <h4>🔑 Verification Codes Found:</h4>
              ${codes.map(code => `<span class="code" onclick="navigator.clipboard.writeText('${code}')">${code}</span>`).join('')}
          </div>
      ` : '';

      content.innerHTML = `
          <h3>${email.subject}</h3>
          <p><strong>From:</strong> ${email.from}</p>
          <p><strong>Time:</strong> ${this.formatTime(email.time)}</p>
          ${codesHtml}
          <div class="email-body">${email.content}</div>
      `;

      modal.style.display = 'block';
  }

  closeModal() {
      document.getElementById('emailModal').style.display = 'none';
  }

  copyEmail() {
      if (this.currentEmail) {
          navigator.clipboard.writeText(this.currentEmail);
          this.showNotification('Email copied to clipboard!', 'success');
      }
  }

  formatTime(date) {
      return new Date(date).toLocaleString();
  }

  extractVerificationCodes(text) {
      // Enhanced patterns for better code detection
      const codePatterns = [
          /\b\d{4,8}\b/g,                                    // Basic numeric codes
          /\b[A-Z0-9]{4,8}\b/g,                              // Alphanumeric codes
          /code[:\s]+([A-Z0-9]{4,8})/gi,                     // "code: 1234"
          /verification[:\s]+([A-Z0-9]{4,8})/gi,             // "verification: 1234"
          /pin[:\s]+(\d{4,6})/gi,                            // "pin: 1234"
          /token[:\s]+([A-Z0-9]{4,8})/gi,                    // "token: abcd1234"
          /confirm[:\s]+([A-Z0-9]{4,8})/gi,                  // "confirm: 1234"
          /activate[:\s]+([A-Z0-9]{4,8})/gi,                 // "activate: 1234"
          /otp[:\s]+([A-Z0-9]{4,8})/gi,                      // "otp: 1234"
          /(?:is|code|otp|pin|verify|confirmation)[:\s]*([A-Z0-9]{4,8})/gi, // Multiple keywords
          /\b([A-Z0-9]{4}[\s-]?[A-Z0-9]{4})\b/g,             // Format: ABCD-1234 or ABCD 1234
          /facebook[^>]*?(\d{4,8})/gi,                       // Facebook specific codes  
      ];

      const codes = [];
      codePatterns.forEach(pattern => {
          const matches = text.match(pattern);
          if (matches) {
              matches.forEach(match => {
                  // Clean the match
                  let cleanCode = match.replace(/^(code|verification|pin|token|confirm|activate|otp|is|verify|confirmation|facebook|instagram|twitter|gmail)[:\s]*/gi, '').trim();
                  cleanCode = cleanCode.replace(/[\s-]/g, ''); // Remove spaces and dashes

                  // Validate code length and format
                  if (cleanCode.length >= 4 && cleanCode.length <= 8 && /^[A-Z0-9]+$/i.test(cleanCode)) {
                      // Filter out common false positives
                      const falsePositives = ['HTML', 'HTTP', 'HTTPS', 'POST', 'HEAD', 'BODY', 'FORM', 'EMAIL', 'USER', 'PASS'];
                      if (!falsePositives.includes(cleanCode.toUpperCase())) {
                          codes.push(cleanCode.toUpperCase());
                      }
                  }
              });
          }
      });

      return [...new Set(codes)]; // Remove duplicates
  }

  showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;

      document.body.appendChild(notification);

      setTimeout(() => {
          notification.remove();
      }, 5000);
  }

  showEmailPopup(email) {
      const popup = document.createElement('div');
      popup.className = 'email-popup';
      const codes = this.extractVerificationCodes(email.content + ' ' + email.subject);
      popup.innerHTML = `
          <div class="popup-header">
              📧 New Email
              <button class="popup-close" onclick="this.parentElement.parentElement.remove()">×</button>
          </div>
          <div class="popup-content">
              <div class="popup-from">From: ${email.from}</div>
              <div class="popup-subject">${email.subject}</div>
              ${codes.length > 0 ? `<div class="popup-codes">Codes: ${codes.map(code => `<span class="code-badge" onclick="navigator.clipboard.writeText('${code}')">${code}</span>`).join('')}</div>` : ''}
          </div>
      `;

      document.body.appendChild(popup);

      setTimeout(() => {
          if (popup.parentNode) {
              popup.remove();
          }
      }, 6000);
  }

  showBrowserNotification(email, codes) {
      if ('Notification' in window && Notification.permission === 'granted') {
          const title = `New Email: ${email.subject}`;
          const body = `From: ${email.from}${codes.length > 0 ? `\nCodes: ${codes.join(', ')}` : ''}`;

          new Notification(title, {
              body: body,
              icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgNEgyMFYyMEg0VjRaIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K'
          });
      }
  }
}
// Add slide animations for notifications and popup styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
      from {
          transform: translateX(100%);
          opacity: 0;
      }
      to {
          transform: translateX(0);
          opacity: 1;
      }
  }

  @keyframes slideOut {
      from {
          transform: translateX(0);
          opacity: 1;
      }
      to {
          transform: translateX(100%);
          opacity: 0;
      }
  }

  .email-popup {
      position: fixed;
      top: 10px;
      right: 10px;
      background: var(--surface-color);
      border: 1px solid var(--primary-color);
      border-radius: 3px;
      box-shadow: var(--shadow);
      z-index: 1003;
      max-width: 140px;
      font-size: 0.55rem;
      animation: slideIn 0.3s ease-out;
  }

  .popup-header {
      background: var(--primary-color);
      color: white;
      padding: 2px 4px;
      display: flex;
      align-items: center;
      gap: 2px;
      border-radius: 2px 2px 0 0;
      font-size: 0.5rem;
  }

  .popup-close {
      margin-left: auto;
      background: none;
      border: none;
      color: white;
      font-size: 8px;
      cursor: pointer;
      padding: 0;
      width: 8px;
      height: 8px;
  }

  .popup-content {
      padding: 3px;
  }

  .popup-from, .popup-subject {
      margin-bottom: 1px;
      font-size: 0.5rem;
  }

  .popup-subject {
      font-weight: bold;
      color: var(--primary-color);
  }

  .popup-codes {
      margin: 2px 0;
      padding: 2px;
      background: var(--background-color);
      border-radius: 2px;
      border-left: 1px solid var(--accent-color);
  }

  .code-highlight, .code-badge {
      background: var(--accent-color);
      color: white;
      padding: 1px 2px;
      border-radius: 2px;
      margin: 0 1px;
      cursor: pointer;
      font-weight: bold;
      display: inline-block;
      font-family: monospace;
      font-size: 0.45rem;
  }

  .code-highlight:hover, .code-badge:hover {
      background: #F57C00;
  }

  .popup-preview {
      color: var(--text-secondary);
      font-size: 0.6rem;
      margin-top: 3px;
      line-height: 1.2;
  }

  .email-codes {
      margin: 8px 0;
      padding: 5px 0;
  }
`;
document.head.appendChild(style);

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              if (confirm('A new version is available. Reload to update?')) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Install prompt for PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('Install prompt available');
  e.preventDefault();
  deferredPrompt = e;
  
  // Show install button after app loads
  setTimeout(() => {
    if (deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
      showInstallPrompt();
    }
  }, 5000);
});

function showInstallPrompt() {
  const installBanner = document.createElement('div');
  installBanner.className = 'install-banner';
  installBanner.innerHTML = `
    <div class="install-content">
      <span>📱 Install Yuen Dispo Mail for offline access</span>
      <button onclick="installApp()" class="btn primary">Install</button>
      <button onclick="this.parentElement.parentElement.remove()" class="btn secondary">Later</button>
    </div>
  `;
  document.body.appendChild(installBanner);
}

async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Install prompt result:', outcome);
    deferredPrompt = null;
    document.querySelector('.install-banner')?.remove();
  }
}

// Background sync for offline email checking
if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
  navigator.serviceWorker.ready.then((registration) => {
    // Register background sync
    registration.sync.register('background-email-sync');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  window.yuenDispoMail = new YuenDispoMail();
});
