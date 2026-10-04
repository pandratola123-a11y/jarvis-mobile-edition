 // ===== 1. API KEY - Secure Version =====
let API_KEY = localStorage.getItem('jarvis_key');
if (!API_KEY || API_KEY.trim() === "") {
  API_KEY = prompt('Enter your Gemini API Key:');
  if (API_KEY && API_KEY.startsWith('AIza')) {
    localStorage.setItem('jarvis_key', API_KEY.trim());
  } else {
    alert('Invalid API Key! Key AIza se start honi chahiye.');
    API_KEY = null;
  }
}
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];

// ===== 2. MEMORY & UI ELEMENTS =====
let MEMORY = [];
try {
  const storedMemory = JSON.parse(localStorage.getItem('jarvis_memory') || '[]');
  if (Array.isArray(storedMemory)) {
    MEMORY = storedMemory.filter(m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string');
  }
} catch (e) { localStorage.removeItem('jarvis_memory'); }
function saveMemory(){ localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY)); }

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const micBtn = document.getElementById('mic-btn');
const clearBtn = document.getElementById('clear-btn');

function add(text, who){
  const div = document.createElement('div');
  div.className = who;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function speak(txt){
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'hi-IN'; // Hindi + English
  speechSynthesis.speak(u);
}
MEMORY.forEach(m=> add((m.role==='user'?'YOU: ':'J.A.R.V.I.S: ')+m.text, m.role==='user'?'user':'ai'));

// ===== 3. TOOLS (THE HANDS) - FIXED =====
function handleTools(text) {
  const t = text.toLowerCase();

  // TIME tool - ab kaam karega
  if(t.includes('time') || t.includes('samay') || t.includes('baje')){
    return `Current time: ${new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}`;
  }
  // WEATHER tool
  if(t.includes('weather') || t.includes('mausam')){
    return `Weather: Berhampur me abhi mausam badhiya hai. (Live weather ke liye API add karna padega, abhi demo data hai)`;
  }
  // NEWS
  if(t.includes('news')){
    return `Aaj ki latest news: Tech duniya me AI ka jalwa hai.`;
  }
  // CRYPTO
  if(t.includes('bitcoin') || t.includes('crypto') || t.includes('btc')){
    return `Crypto: Bitcoin is trending. Live price ke liye API connect karna hoga.`;
  }
  // TIMER
  const timerMatch = text.match(/(\d+)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?|s)/i);
  if (timerMatch) {
    const amount = parseInt(timerMatch[1]);
    const unit = timerMatch[2].toLowerCase();
    const factor = /^(hours?|hrs?)/.test(unit)? 3600000 : /^(seconds?|secs?|s)/.test(unit)? 1000 : 60000;
    const duration = amount * factor;
    setTimeout(() => {
      const msg = `Timer pura ho gaya! ${amount} ${unit} ho gaye.`;
      add(`J.A.R.V.I.S: ${msg}`, 'ai');
      speak(msg);
    }, duration);
    return `Timer set for ${amount} ${unit}.`;
  }
  return null;
}

// ===== 3.5. AGENT MODE ENGINE - FIXED =====
const AGENT_TOOLS = Object.freeze({
  time: async () => handleTools('current time'),
  weather: async () => handleTools('weather'),
  news: async () => handleTools('search news'),
  crypto: async () => handleTools('search bitcoin')
});
const AGENT_TOOL_NAMES = Object.freeze({ time: 'time', weather: 'weather', news: 'news', crypto: 'crypto' });

function isAgentModeRequest(text=''){
  const value=String(text||'').toLowerCase();
  if(/\b(?:agent(?:\s+mode)?|briefing|morning briefing)\b/i.test(value)) return true;
  return /\b(?:give me my.*briefing|aaj ka plan)\b/i.test(value);
}
function parseAgentToolPlan(responseText){
  const text=String(responseText||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=text.indexOf('['), end=text.lastIndexOf(']');
  if(start<0||end<start) throw new Error('Agent plan format incorrect.');
  let parsed = JSON.parse(text.slice(start,end+1));
  const allowed=new Set(Object.keys(AGENT_TOOLS));
  return [...new Set(parsed.filter(item=>typeof item==='string').map(item=>item.trim().toLowerCase()).filter(item=>allowed.has(item)))];
}
function fallbackAgentToolPlan(goal){
  const g = String(goal).toLowerCase();
  let tools = [];
  if(g.includes('morning') || g.includes('briefing')) tools = ['time','weather','news'];
  else {
    if(g.includes('time')) tools.push('time');
    if(g.includes('weather')) tools.push('weather');
    if(g.includes('news')) tools.push('news');
    if(g.includes('bitcoin')||g.includes('crypto')) tools.push('crypto');
  }
  return tools.length? tools : ['time','weather'];
}
async function runAgent(goal){
  add('J.A.R.V.I.S: Agent mode active hai Boss.','ai');
  add('J.A.R.V.I.S: Goal analyze kar raha hu...','ai');
  const planPrompt='Select tools from ["time","weather","news","crypto"] as JSON array only. Goal: '+JSON.stringify(String(goal));
  let toolsToRun;
  try{ toolsToRun=parseAgentToolPlan(await callGeminiRaw(planPrompt)); }catch(e){ toolsToRun=fallbackAgentToolPlan(goal); }
  const results={};
  for(let i=0;i<toolsToRun.length;i++){
    const tool=toolsToRun[i];
    add(`J.A.R.V.I.S: [${i+1}/${toolsToRun.length}] ${AGENT_TOOL_NAMES[tool]} tool chala raha hu...`,'ai');
    try{ results[tool]=await AGENT_TOOLS[tool](); }catch(e){ results[tool]='Tool error'; }
  }
  add('J.A.R.V.I.S: Results combine kar raha hu...','ai');
  const summaryPrompt='Goal: '+JSON.stringify(String(goal))+'. Tool results: '+JSON.stringify(results)+'. Give a concise summary in Hindi/English. User location: Berhampur, Odisha. Current time: '+new Date().toString();
  return await callGemini(summaryPrompt);
}

// ===== 4. GEMINI BRAIN =====
async function callGeminiRaw(prompt){
  if(!API_KEY) throw new Error('Gemini API key missing');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[0]}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({contents:[{role:'user', parts:[{text:prompt}]}]}) });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}
async function callGemini(p){
  if(!API_KEY) throw new Error('Gemini API key is missing.');
  const contents = MEMORY.slice(-12).map(m=>({role:m.role, parts:[{text:m.text}]}));
  contents.push({role:'user', parts:[{text:p}]});
  for(const model of MODELS){
    try{
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({contents}) });
      const d = await r.json();
      const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
      if(text){ MEMORY.push({role:'user', text:p}); MEMORY.push({role:'model', text:text}); saveMemory(); return text; }
    }catch(e){ console.warn(model+' failed', e); }
  }
  throw new Error('All models failed, Boss.');
}

// ===== 5. MAIN HANDLER =====
async function handleMessage(text){
  add('YOU: '+text, 'user');
  if(isAgentModeRequest(text)){
    const res = await runAgent(text);
    add('J.A.R.V.I.S: '+res, 'ai');
    speak(res);
    return;
  }
  let toolResult = await handleTools(text);
  if(toolResult){ add('J.A.R.V.I.S: '+toolResult, 'ai'); speak(toolResult); return; }
  try{
    const aiResult = await callGemini(text);
    add('J.A.R.V.I.S: '+aiResult, 'ai');
    speak(aiResult);
  }catch(e){ add('J.A.R.V.I.S: Error - '+e.message, 'ai'); }
}
if(input){
  input.addEventListener('keydown', e=>{
    if(e.key==='Enter' && input.value.trim()){
      handleMessage(input.value.trim());
      input.value='';
    }
  });
}
const sendBtn = document.getElementById('send-btn') || document.querySelector('[id*="send"]');
if(sendBtn && input){ sendBtn.onclick = ()=>{ if(input.value.trim()){ handleMessage(input.value.trim()); input.value=''; } } }
if(micBtn){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SR){
    const rec = new SR();
    rec.lang = 'hi-IN';
    rec.onresult = e => handleMessage(e.results[0][0].transcript);
    micBtn.onclick = ()=> rec.start();
  }
}
if(clearBtn){ clearBtn.onclick = ()=>{ MEMORY=[]; saveMemory(); chat.innerHTML=''; } }
