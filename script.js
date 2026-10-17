 // ===== 1. API KEY =====
let API_KEY = localStorage.getItem('jarvis_key');
if (!API_KEY) {
  API_KEY = prompt('Enter your Gemini API Key:');
  if (API_KEY) localStorage.setItem('jarvis_key', API_KEY);
}

function extractInteractionText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const steps = Array.isArray(data?.steps) ? data.steps : Array.isArray(data?.outputs) ? data.outputs : [];
  return steps
    .filter(step => step && (step.type === 'model_output' || step.type === 'text' || !step.type))
    .flatMap(step => Array.isArray(step.content) ? step.content : typeof step.text === 'string' ? [{ type: 'text', text: step.text }] : [])
    .filter(part => part && (part.type === 'text' || typeof part.text === 'string') && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n')
    .trim();
}

async function requestGeminiInteraction(input, systemInstruction = GEMINI_SYSTEM_INSTRUCTION) {
  if (!API_KEY) throw new Error('Gemini API key is missing. Reload the page and enter it again.');
  const payload = { model: GEMINI_MODEL, input, store: false };
  if (systemInstruction) payload.system_instruction = systemInstruction;
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
      'Api-Revision': '2026-05-20'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || 'Gemini request failed (' + response.status + ').');
  }
  const reply = extractInteractionText(data);
  if (!reply) throw new Error(data?.status === 'failed' ? 'Gemini could not complete this request.' : 'Gemini returned an empty response.');
  return reply;
}
const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_SYSTEM_INSTRUCTION = 'You are J.A.R.V.I.S, a friendly personal assistant for Vamshi. Reply naturally in a warm Telugu-English mix, using clear concise language. If you do not know, say so plainly.';

// ===== 2. MEMORY =====
let MEMORY = [];
try {
  const storedMemory = JSON.parse(localStorage.getItem('jarvis_memory') || '[]');
  if (Array.isArray(storedMemory)) {
    MEMORY = storedMemory.filter(m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && !(m.role === 'model' && /^(?:Your strong password:|ఇదిగో strong password:)/i.test(m.text)));
    if (MEMORY.length !== storedMemory.length) localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
  } else {
    localStorage.removeItem('jarvis_memory');
  }
} catch (e) {
  localStorage.removeItem('jarvis_memory');
}

const chat = document.getElementById('chat');
const conversationStage = document.getElementById('conversation-stage');
const input = document.getElementById('msg');
const micBtn = document.getElementById('mic-btn');
const clearBtn = document.getElementById('clear-btn');
const camBtn = document.getElementById('cam-btn');
const imgInput = document.getElementById('img-input');
const historyList = document.getElementById('history-list');
const historyCount = document.getElementById('history-count');
const menuButton = document.getElementById('menu-btn');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const settingsOpen = document.getElementById('settings-open');
const settingsClose = document.getElementById('settings-close');
const settingsPanel = document.getElementById('settings-panel');
const settingsScrim = document.getElementById('settings-scrim');
const themeSelect = document.getElementById('theme-select');
const clearMemorySetting = document.getElementById('clear-memory-setting');
const thinkingStatus = document.getElementById('thinking-status');
const thinkingLabel = document.getElementById('thinking-label');

const HISTORY_KEY = 'jarvis_conversation_history_v1';
const ACTIVE_CONVERSATION_KEY = 'jarvis_active_conversation_v1';
let CONVERSATIONS = [];

try {
  const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  if (Array.isArray(stored)) {
    CONVERSATIONS = stored.filter(c => c && typeof c.id === 'string' && Array.isArray(c.messages)).map(c => ({
      ...c,
      messages: c.messages.filter(m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
    }));
  }
} catch (e) {
  localStorage.removeItem(HISTORY_KEY);
}

function makeConversationId() {
  return 'chat_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function conversationTitle(messages) {
  const first = (messages || []).find(m => m && m.role === 'user' && typeof m.text === 'string');
  return first ? (first.text.replace(/\s+/g, ' ').trim().slice(0, 42) || 'New chat') : 'New chat';
}

let ACTIVE_CONVERSATION_ID = localStorage.getItem(ACTIVE_CONVERSATION_KEY) || '';
let initialConversation = CONVERSATIONS.find(c => c.id === ACTIVE_CONVERSATION_ID);
if (!initialConversation) {
  initialConversation = {
    id: makeConversationId(),
    title: conversationTitle(MEMORY),
    updatedAt: Date.now(),
    messages: MEMORY.slice(-120)
  };
  CONVERSATIONS.unshift(initialConversation);
  ACTIVE_CONVERSATION_ID = initialConversation.id;
} else {
  MEMORY = initialConversation.messages.length ? initialConversation.messages.slice(-120) : MEMORY.slice(-120);
  initialConversation.messages = MEMORY.slice(-120);
  initialConversation.title = conversationTitle(MEMORY) || initialConversation.title || 'New chat';
}
localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
localStorage.setItem(ACTIVE_CONVERSATION_KEY, ACTIVE_CONVERSATION_ID);

function currentConversation() {
  return CONVERSATIONS.find(c => c.id === ACTIVE_CONVERSATION_ID);
}

function saveMemory() {
  localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
  const current = currentConversation();
  if (current) {
    current.messages = MEMORY.slice(-120);
    current.updatedAt = Date.now();
    current.title = conversationTitle(current.messages) || current.title || 'New chat';
    CONVERSATIONS.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    CONVERSATIONS = CONVERSATIONS.slice(0, 30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(CONVERSATIONS));
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, ACTIVE_CONVERSATION_ID);
    renderHistoryList();
  }
}

function renderHistoryList() {
  if (!historyList) return;
  const visible = CONVERSATIONS.filter(c => c.messages && c.messages.length).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (historyCount) historyCount.textContent = visible.length ? String(visible.length) : '';
  historyList.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = 'Your conversations will appear here';
    historyList.appendChild(empty);
    return;
  }

  visible.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.dataset.conversationId = item.id;
    button.setAttribute('aria-current', String(item.id === ACTIVE_CONVERSATION_ID));

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5zM5 5.5v15M9 7h6M9 10h7');
    icon.appendChild(path);

    const label = document.createElement('span');
    label.className = 'history-item-label';
    label.textContent = item.title || conversationTitle(item.messages);

    button.append(icon, label);
    button.addEventListener('click', () => switchConversation(item.id));
    historyList.appendChild(button);
  });
}

function setThinking(active, message) {
  const on = Boolean(active);
  if (on && thinkingLabel) thinkingLabel.textContent = message || 'J.A.R.V.I.S is thinking';
  document.body.classList.toggle('is-thinking', on);
  if (thinkingStatus) thinkingStatus.hidden = !on;
}

function scrollConversationToBottom() {
  if (!chat) return;
  const scroll = () => { chat.scrollTop = chat.scrollHeight; };
  if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(scroll);
  else setTimeout(scroll, 16);
}

function setReply(node, text) {
  if (!node) return;
  node.innerText = text;
  scrollConversationToBottom();
}

function activityLabel(text) {
  return String(text).replace(/^J\.A\.R\.V\.I\.S:\s*/i, '').replace(/\.{3}$/, '').trim() || 'J.A.R.V.I.S is thinking';
}

function isTransientActivity(text) {
  const clean = String(text).replace(/^J\.A\.R\.V\.I\.S:\s*/i, '');
  return /^(?:Thinking\.\.\.|Agent mode active\.|Goal analyze\b|\[\d+\/\d+\].*tool run chesthunna|Results combine chesthunna|Gemini busy undi;)/i.test(clean);
}

function closeSidebarOnMobile() {
  if (window.matchMedia('(max-width: 780px)').matches) {
    document.body.classList.remove('sidebar-open');
    if (sidebarBackdrop) sidebarBackdrop.hidden = true;
  }
}

function toggleSidebar() {
  if (window.matchMedia('(max-width: 780px)').matches) {
    const open = !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', open);
    if (sidebarBackdrop) sidebarBackdrop.hidden = !open;
  } else {
    document.body.classList.toggle('sidebar-collapsed');
  }
}

function switchConversation(id) {
  if (id === ACTIVE_CONVERSATION_ID) {
    closeSidebarOnMobile();
    return;
  }
  const next = CONVERSATIONS.find(c => c.id === id);
  if (!next) return;
  const current = currentConversation();
  if (current) {
    current.messages = MEMORY.slice(-120);
    current.updatedAt = Date.now();
  }
  ACTIVE_CONVERSATION_ID = id;
  MEMORY = next.messages.slice(-120);
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
  localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
  chat.replaceChildren();
  MEMORY.forEach(m => add((m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ') + m.text, m.role === 'user' ? 'user' : 'ai'));
  document.body.classList.toggle('has-conversation', MEMORY.length > 0);
  renderHistoryList();
  scrollConversationToBottom();
  closeSidebarOnMobile();
}

function startNewConversation() {
  if (!MEMORY.length) {
    input.focus();
    closeSidebarOnMobile();
    return;
  }
  const current = currentConversation();
  if (current) {
    current.messages = MEMORY.slice(-120);
    current.updatedAt = Date.now();
  }
  const fresh = { id: makeConversationId(), title: 'New chat', updatedAt: Date.now(), messages: [] };
  CONVERSATIONS.unshift(fresh);
  CONVERSATIONS = CONVERSATIONS.slice(0, 30);
  ACTIVE_CONVERSATION_ID = fresh.id;
  MEMORY = [];
  localStorage.setItem('jarvis_memory', '[]');
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, ACTIVE_CONVERSATION_ID);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(CONVERSATIONS));
  chat.replaceChildren();
  document.body.classList.remove('has-conversation');
  chat.scrollTop = 0;
  conversationStage.scrollTop = 0;
  renderHistoryList();
  input.value = '';
  input.style.height = 'auto';
  input.focus();
}

function openSettings() {
  settingsPanel.hidden = false;
  settingsScrim.hidden = false;
  closeSidebarOnMobile();
  settingsClose.focus();
}

function closeSettings() {
  settingsPanel.hidden = true;
  settingsScrim.hidden = true;
  if (window.matchMedia('(max-width: 780px)').matches && !document.body.classList.contains('sidebar-open')) menuButton.focus();
}

function applyTheme(theme) {
  const chosen = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = chosen;
  localStorage.setItem('jarvis_theme', chosen);
  if (themeSelect) themeSelect.value = chosen;
}

renderHistoryList();
applyTheme(localStorage.getItem('jarvis_theme') || 'dark');
MEMORY.forEach(m => add((m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ') + m.text, m.role === 'user' ? 'user' : 'ai'));

// ===== 3. TOOLS (THE HANDS) =====
async function fetchToolJson(url, options = {}, timeoutMs = 10000) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
    if (!response.ok) throw new Error('Request failed (' + response.status + ').');
    return await response.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function handleTools(text) {
  const t = text.toLowerCase();

  if (/^\s*(?:please\s+)?(?:open\s+youtube|youtube\s+open|youtube)(?:\s+please)?[.!?]*\s*$/i.test(text)) {
    window.open('https://youtube.com', '_blank', 'noopener,noreferrer');
    return 'Opening YouTube, Boss.';
  }
  if (/^\s*(?:please\s+)?(?:open\s+google|google\s+open|google)(?:\s+please)?[.!?]*\s*$/i.test(text)) {
    window.open('https://google.com', '_blank', 'noopener,noreferrer');
    return 'Opening Google, Boss.';
  }

  const urlCommand = text.match(/^\s*(?:open|visit|go to)\s+(https?:\/\/\S+)\s*$/i);
  if (urlCommand) {
    try {
      const destination = new URL(urlCommand[1]);
      if (destination.protocol !== 'https:' && destination.protocol !== 'http:') return 'Only http and https links can be opened.';
      window.open(destination.href, '_blank', 'noopener,noreferrer');
      return 'Opening ' + destination.hostname + ', Boss.';
    } catch (e) {
      return 'That link does not look valid.';
    }
  }

  if (/^\s*(?:google\s+search|search\s+(?:on\s+)?google)(?:\s+for)?\s*$/i.test(text)) return 'Tell me what to search for on Google.';
  const googleSearch = text.match(/^\s*(?:google\s+search|search\s+(?:on\s+)?google)(?:\s+for)?\s+(.+?)\s*$/i);
  if (googleSearch) {
    const query = googleSearch[1].trim();
    if (!query) return 'Tell me what to search for on Google.';
    window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank', 'noopener,noreferrer');
    return 'Searching Google for ' + query + ', Boss.';
  }

  if (/^\s*(?:play|youtube\s+search|search\s+(?:on\s+)?youtube)(?:\s+for)?\s*$/i.test(text)) return 'Tell me a song or search phrase for YouTube.';
  const playMatch = text.match(/^\s*play\s+(.+?)\s*$/i);
  const youtubeMatch = text.match(/^\s*youtube(?:\s+search)?(?:\s+for)?\s+(.+?)\s*$/i);
  const searchYoutubeMatch = text.match(/^\s*search\s+(?:on\s+)?youtube(?:\s+for)?\s+(.+?)\s*$/i);
  const videoQuery = (playMatch || youtubeMatch || searchYoutubeMatch)?.[1]?.trim();
  if (videoQuery) {
    window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(videoQuery), '_blank', 'noopener,noreferrer');
    return 'Searching YouTube for ' + videoQuery + ', Boss.';
  }

  if (/^\s*(?:search|look up)(?:\s+for)?\s*$/i.test(text)) return 'Tell me what to search for.';
  const searchMatch = text.match(/^\s*(?:search|look up)\s+(?:for\s+)?(.+?)\s*$/i);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    if (!query) return 'Tell me what to search for.';
    try {
      const url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&srsearch=' + encodeURIComponent(query) + '&format=json&origin=*';
      const data = await fetchToolJson(url);
      const result = data?.query?.search?.[0];
      if (!result) return 'I could not find that, Boss.';
      const snippet = String(result.snippet || '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      return 'Wikipedia summary: ' + result.title + (snippet ? '. ' + snippet : '');
    } catch (e) {
      return 'Search error, Boss.';
    }
  }

  if (/\b(?:what time(?: is it)?|what is the time|current time|tell me the time|time now)\b/.test(t) || /^\s*time(?:\s+please)?[.!?]*\s*$/.test(t) || t.includes('టైమ్') || t.includes('సమయం') || t.includes('samayam')) {
    return 'The time is ' + new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }) + ' IST, Boss.';
  }

  if (t.includes('weather') || t.includes('వాతావరణం')) {
    if (!navigator.geolocation) return 'I need location permission for weather, Boss.';
    return await new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(async position => {
        try {
          const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + position.coords.latitude + '&longitude=' + position.coords.longitude + '&current_weather=true';
          const data = await fetchToolJson(url);
          const temperatureValue = data?.current_weather?.temperature ?? data?.current?.temperature_2m;
          const temperature = Number(temperatureValue);
          if (temperatureValue === null || temperatureValue === undefined || !Number.isFinite(temperature)) throw new Error('Weather data unavailable.');
          resolve('It is ' + temperature + ' degrees Celsius now, Boss.');
        } catch (e) {
          resolve('Weather service error, Boss.');
        }
      }, () => resolve('I need location permission for weather, Boss.'), { timeout: 10000, maximumAge: 300000 });
    });
  }

  const timerCommand = t.includes('timer') || t.includes('టైమర్');
  if (timerCommand) {
    const m = t.match(/(-?\d+(?:\.\d+)?)\s*(seconds?|secs?|sec|s|minutes?|mins?|min|m|hours?|hrs?|hr|h|నిమిషం|నిమిషాలు|సెకను|సెకన్లు|గంట|గంటలు)/i);
    if (!m) return 'Timer format: say “timer 5 minutes”.';
    const amount = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) return 'Timer duration must be greater than zero.';
    const factor = /^(?:h|hr|hrs|hour|hours|గంట|గంటలు)/.test(unit) ? 3600000 : /^(?:s|sec|secs|second|seconds|సెకను|సెకన్లు)/.test(unit) ? 1000 : 60000;
    const duration = amount * factor;
    if (duration > 86400000) return 'Timer limit is 24 hours.';
    setTimeout(() => speakWithWakePause('టైమర్ పూర్తైంది! ' + amount + ' ' + unit + ' అయ్యాయి.'), duration);
    return 'Timer set for ' + amount + ' ' + unit + '.';
  }

  if (/\bdice\b/.test(t)) return 'You rolled ' + (Math.floor(Math.random() * 6) + 1) + ', Boss.';
  if (/\bcoin\b/.test(t)) return Math.random() < 0.5 ? 'Heads, Boss.' : 'Tails, Boss.';

  if (/\bjoke\b/.test(t)) {
    try {
      const data = await fetchToolJson('https://official-joke-api.appspot.com/random_joke');
      if (typeof data?.setup !== 'string' || typeof data?.punchline !== 'string') throw new Error('Invalid joke response.');
      return data.setup + ' ... ' + data.punchline;
    } catch (e) {
      try {
        const backup = await fetchToolJson('https://v2.jokeapi.dev/joke/Any?type=twopart&safe-mode');
        if (!backup?.error && backup?.type === 'twopart' && typeof backup.setup === 'string' && typeof backup.delivery === 'string') return backup.setup + ' ... ' + backup.delivery;
      } catch (x) {}
      const fallback = [['Why did the computer go to the doctor?', 'It had a virus.'], ['Why was the math book sad?', 'It had too many problems.']];
      const joke = fallback[Math.floor(Math.random() * fallback.length)];
      return joke[0] + ' ... ' + joke[1];
    }
  }

  if (t.includes('quote') || t.includes('motivate')) {
    try {
      const data = await fetchToolJson('https://dummyjson.com/quotes/random');
      if (typeof data?.quote !== 'string' || typeof data?.author !== 'string') throw new Error('Invalid quote response.');
      return data.quote + ' — by ' + data.author;
    } catch (e) {
      return 'A small step today is still progress. — by J.A.R.V.I.S';
    }
  }

  if (/\bnews\b/.test(t)) {
    try {
      const ids = await fetchToolJson('https://hacker-news.firebaseio.com/v0/topstories.json');
      if (!Array.isA
