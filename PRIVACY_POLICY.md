# Privacy Policy — FinePrint

**Last updated:** March 15, 2026

FinePrint is a Chrome extension that helps you understand Terms & Conditions and Privacy Policies by providing AI-powered summaries and security ratings. This privacy policy explains what data the extension accesses, how it is used, and how it is protected.

---

## Summary

- FinePrint **does not collect, transmit, or store any personal data** on external servers.
- All processing happens **locally in your browser** or through a **direct API call to Google's Gemini service using your own API key**.
- We have **no backend, no analytics, no tracking, and no user accounts**.

---

## 1. Data the Extension Accesses

### 1.1 Web Page Content

FinePrint's content script runs on web pages you visit to detect links to Terms & Conditions, Privacy Policies, and similar legal documents. The detection uses pattern matching against link URLs and link text only. The extension does **not** read, collect, or transmit the general content of web pages you visit.

When you choose to analyze a specific legal document (by clicking the shield badge or the "Analyze" button), the extension fetches the publicly accessible text of that legal document URL to perform analysis.

### 1.2 API Key

To perform AI-powered analysis, FinePrint requires a Google Gemini API key that you provide during setup. This key is:

- Stored locally in your browser using `chrome.storage.local` (encrypted at rest by Chrome)
- Used exclusively to authenticate requests to the Google Generative Language API
- **Never transmitted to any server or service other than the Google Gemini API**
- **Never accessible to FinePrint's developers or any third party**

### 1.3 Active Tab URL

The extension uses the `activeTab` and `tabs` permissions to identify the URL of the page you are viewing. This is used solely to:

- Detect legal document links on the current page
- Retrieve cached analysis results for pages you have previously analyzed
- Fetch legal document text when you request an analysis

Tab URLs are **not logged, collected, or transmitted** to any external service.

---

## 2. How Data Is Used

| Data                                       | Purpose                                                | Stored?                       | Sent externally?                                                   |
| ------------------------------------------ | ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------ |
| Legal document text                        | Sent to Google Gemini API for analysis                 | Cached locally in IndexedDB   | Yes — to Google's Gemini API only, using your own API key          |
| Analysis results (summaries, scores)       | Displayed in the extension popup                       | Cached locally in IndexedDB   | No                                                                 |
| Your Gemini API key                        | Authenticating API requests                            | Yes — in chrome.storage.local | Yes — to Google's Gemini API only (as an authentication parameter) |
| Page URLs                                  | Detecting legal links and matching cached results      | Temporarily in memory         | No                                                                 |
| Dismissed overlay preferences              | Remembering which sites you've dismissed the prompt on | Yes — in chrome.storage.local | No                                                                 |
| Extension settings (detection preferences) | Configuring extension behavior                         | Yes — in chrome.storage.local | No                                                                 |

---

## 3. Data Storage

All data is stored **locally on your device** using standard Chrome extension storage mechanisms:

- **`chrome.storage.local`** — Stores your API key, extension settings, and overlay dismissal preferences. This storage is encrypted at rest by Chrome and is only accessible to the FinePrint extension. **Note:** If you have Chrome Sync enabled, this data (including your API key) may be synchronized to Google's servers and your other Chrome browsers. You can disable extension sync in Chrome settings to keep data on a single device.
- **IndexedDB** — Stores cached analysis results and document version history for diff tracking. This data remains on your device and is subject to a maximum storage limit of 50 MB with automatic cleanup of oldest entries.

No data is stored on any external server, cloud service, or database operated by FinePrint or its developers.

---

## 4. Third-Party Services

### Google Gemini API

When you request an analysis, the text of the legal document is sent to the [Google Generative Language API](https://ai.google.dev/) (Gemini) for processing. This request is made:

- Directly from your browser to Google's servers
- Authenticated with **your own API key** (not a shared key)
- Over HTTPS

The data sent to Google is subject to [Google's API Terms of Service](https://developers.google.com/terms) and [Google's Privacy Policy](https://policies.google.com/privacy). FinePrint's developers have no access to your API requests, responses, or API key.

**No other third-party services are used.** FinePrint does not use analytics services, crash reporting tools, advertising networks, or any other external services.

---

## 5. Data Sharing

FinePrint **does not share any data** with:

- FinePrint's developers
- Third parties, advertisers, or data brokers
- Any server or service other than the Google Gemini API (and only when you explicitly request an analysis)

---

## 6. Permissions Explained

| Permission  | Why it's needed                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `activeTab` | To detect legal document links on the page you're currently viewing                                   |
| `storage`   | To save your API key, settings, and cached analysis results locally                                   |
| `tabs`      | To identify the current page URL for cache lookup and to send messages between the popup and the page |

The extension runs content scripts on all URLs (`<all_urls>`) to detect T&C links across all websites. The content script is lightweight and only performs pattern matching — it does not read or transmit page content.

---

## 7. User Control

You have full control over your data:

- **Delete cached analyses** — Clear the extension's storage from `chrome://extensions` → FinePrint → Details → "Clear data"
- **Remove your API key** — Open the extension settings and delete your access code at any time
- **Disable detection** — Toggle off "Auto-detect T&C links" in settings to stop all page scanning
- **Uninstall** — Removing the extension deletes all locally stored data immediately

---

## 8. Children's Privacy

FinePrint does not knowingly collect any personal information from children under the age of 13. The extension does not collect personal information from any user.

---

## 9. Changes to This Policy

If this privacy policy is updated, the changes will be published in the extension's repository and the "Last updated" date at the top will be revised. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## 10. Contact

If you have questions about this privacy policy or the extension's data practices, please open an issue on the [GitHub repository](https://github.com/kartikeyaagr/fineprint) or contact the developer directly.

---

## 11. Open Source

FinePrint is open source. You can review the complete source code to verify every claim in this privacy policy. The code is available at [github.com/kartikeyaagr/fineprint](https://github.com/kartikeyaagr/fineprint).
