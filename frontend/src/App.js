import React, { useState, useEffect, lazy, Suspense } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import './App.css';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const msalConfig = {
  auth: {
    clientId: 'your_client_id',
    authority: 'https://login.microsoftonline.com/your_tenant_id',
    redirectUri: window.location.origin
  }
};
const msalInstance = new PublicClientApplication(msalConfig);

const ContextBuilder = lazy(() => Promise.resolve({
  default: ({ context, setContext, saveContext, close }) => (
    <div className="absolute inset-0 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg z-20" role="dialog" aria-labelledby="context-builder-title">
      <h2 id="context-builder-title" className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Context Builder</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="personal-details" className="block text-sm font-medium text-gray-900 dark:text-white">Personal Details</label>
          <textarea
            id="personal-details"
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="E.g., Name, profession"
            value={context.personalDetails}
            onChange={(e) => setContext({ ...context, personalDetails: e.target.value })}
            aria-describedby="personal-details-desc"
          />
          <p id="personal-details-desc" className="text-xs text-gray-500 dark:text-gray-400">Enter your name and profession.</p>
        </div>
        <div>
          <label htmlFor="priorities" className="block text-sm font-medium text-gray-900 dark:text-white">Priorities</label>
          <textarea
            id="priorities"
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="E.g., Prioritize urgent emails"
            value={context.priorities}
            onChange={(e) => setContext({ ...context, priorities: e.target.value })}
            aria-describedby="priorities-desc"
          />
          <p id="priorities-desc" className="text-xs text-gray-500 dark:text-gray-400">Specify your task priorities.</p>
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-900 dark:text-white">Notes</label>
          <textarea
            id="notes"
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="E.g., I run a tree-cutting business: tree removal, pruning"
            value={context.notes}
            onChange={(e) => setContext({ ...context, notes: e.target.value })}
            aria-describedby="notes-desc"
          />
          <p id="notes-desc" className="text-xs text-gray-500 dark:text-gray-400">Add business or personal notes.</p>
        </div>
        <div>
          <label htmlFor="reminder-timing" className="block text-sm font-medium text-gray-900 dark:text-white">Reminder Timing (minutes)</label>
          <input
            id="reminder-timing"
            type="number"
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            value={context.reminderTiming}
            onChange={(e) => setContext({ ...context, reminderTiming: e.target.value })}
            min="1"
            aria-describedby="reminder-timing-desc"
          />
          <p id="reminder-timing-desc" className="text-xs text-gray-500 dark:text-gray-400">Set default reminder time.</p>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 dark:hover:bg-blue-700"
          onClick={saveContext}
          aria-label="Save context"
        >
          Save
        </button>
        <button
          className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 dark:hover:bg-gray-700"
          onClick={close}
          aria-label="Cancel context changes"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}));

function App() {
  const [user, setUser] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContextBuilder, setShowContextBuilder] = useState(false);
  const [context, setContext] = useState({
    personalDetails: '',
    priorities: '',
    notes: '',
    reminderTiming: '15'
  });
  const [aiStatus, setAiStatus] = useState('waiting');

  const login = async () => {
    setLoading(true);
    setAiStatus('thinking');
    try {
      const loginResponse = await msalInstance.loginPopup({
        scopes: ['User.Read', 'Mail.ReadWrite', 'Calendars.ReadWrite']
      });
      setUser(loginResponse.account);
      setAiStatus('completed');
      setLoading(false);
    } catch (err) {
      setError('Login failed. Please try again.');
      setAiStatus('error');
      setLoading(false);
    }
  };

  const fetchContext = async () => {
    setAiStatus('thinking');
    try {
      const token = await msalInstance.acquireTokenSilent({
        scopes: ['User.Read'],
        account: user
      });
      const response = await axios.get('http://localhost:3001/api/context', {
        headers: { Authorization: `Bearer ${token.accessToken}` }
      });
      setContext(response.data);
      setAiStatus('completed');
    } catch (err) {
      setError('Failed to load context.');
      setAiStatus('error');
    }
  };

  const saveContext = async () => {
    setLoading(true);
    setAiStatus('thinking');
    try {
      const token = await msalInstance.acquireTokenSilent({
        scopes: ['User.Read'],
        account: user
      });
      await axios.post('http://localhost:3001/api/context', context, {
        headers: { Authorization: `Bearer ${token.accessToken}` }
      });
      setShowContextBuilder(false);
      setAiStatus('completed');
      setLoading(false);
    } catch (err) {
      setError('Failed to save context.');
      setAiStatus('error');
      setLoading(false);
    }
  };

  const handlePrompt = async () => {
    if (!prompt) return;
    setLoading(true);
    setAiStatus('thinking');
    try {
      const token = await msalInstance.acquireTokenSilent({
        scopes: ['Mail.ReadWrite', 'Calendars.ReadWrite'],
        account: user
      });
      const response = await axios.post('http://localhost:3001/api/prompt', {
        prompt,
        context
      }, {
        headers: { Authorization: `Bearer ${token.accessToken}` }
      });
      setResult(response.data.result);
      setPrompt('');
      setAiStatus('completed');
      setLoading(false);
    } catch (err) {
      setError('Failed to process prompt. Please clarify or try again.');
      setAiStatus('error');
      setLoading(false);
    }
  };

  const logout = () => {
    msalInstance.logoutPopup();
    setUser(null);
    setAiStatus('waiting');
  };

  useEffect(() => {
    msalInstance.handleRedirectPromise().then(response => {
      if (response) {
        setUser(response.account);
        fetchContext();
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 relative" role="main" aria-label="AI Email Agent">
        <h1 className="text-xl font-semibold text-center mb-4" id="app-title">AI Email Agent</h1>
        <div className="flex justify-center mb-4" aria-live="polite" aria-label={`AI status: ${aiStatus}`}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            className={`ai-agent-${aiStatus}`}
            role="img"
            aria-label={aiStatus === 'completed' ? 'Task completed' : aiStatus === 'error' ? 'Error occurred' : aiStatus === 'thinking' ? 'Processing' : 'Waiting'}
          >
            {aiStatus === 'completed' ? (
              <>
                <circle cx="20" cy="20" r="18" fill="inherit" />
                <path d="M15 20 l3 3 l7-7" fill="none" stroke="white" strokeWidth="3" />
              </>
            ) : (
              <circle cx="20" cy="20" r="18" fill="inherit" />
            )}
          </svg>
        </div>
        {loading && <div className="text-center text-gray-500" aria-live="polite">Loading...</div>}
        {error && <div className="text-red-500 text-center mb-4" aria-live="assertive">{error}</div>}
        {!user ? (
          <button
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={login}
            aria-label="Login with Microsoft"
          >
            Login with Microsoft
          </button>
        ) : (
          <div>
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell the AI what to do..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePrompt()}
                aria-label="AI prompt input"
                aria-describedby="prompt-desc"
              />
              <p id="prompt-desc" className="sr-only">Enter commands like 'read emails' or 'add event'.</p>
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                onClick={handlePrompt}
                aria-label="Send prompt"
              >
                Send
              </button>
            </div>
            {result && (
              <div className="border p-4 rounded bg-gray-50 mb-4" aria-live="polite">
                <p>{result}</p>
              </div>
            )}
            <div className="relative">
              <button
                className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                aria-controls="menu"
              >
                Menu
              </button>
              {menuOpen && (
                <div id="menu" className="absolute w-full mt-2 bg-white border rounded shadow-lg z-10" role="menu">
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      setPrompt('Show my latest emails');
                      setMenuOpen(false);
                      handlePrompt();
                    }}
                    role="menuitem"
                    aria-label="View latest emails"
                  >
                    View Emails
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      setPrompt('Show my upcoming events');
                      setMenuOpen(false);
                      handlePrompt();
                    }}
                    role="menuitem"
                    aria-label="View upcoming events"
                  >
                    View Calendar
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      setPrompt('Show my reminders');
                      setMenuOpen(false);
                      handlePrompt();
                    }}
                    role="menuitem"
                    aria-label="View reminders"
                  >
                    View Reminders
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      setShowContextBuilder(true);
                      setMenuOpen(false);
                    }}
                    role="menuitem"
                    aria-label="Open Context Builder"
                  >
                    Context Builder
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    role="menuitem"
                    aria-label="Logout"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
            {showContextBuilder && (
              <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
                <ContextBuilder
                  context={context}
                  setContext={setContext}
                  saveContext={saveContext}
                  close={() => setShowContextBuilder(false)}
                />
              </Suspense>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;