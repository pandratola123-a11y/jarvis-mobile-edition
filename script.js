  // ===== 1. API KEY & SMART MODELS =====
let API_KEY = localStorage.getItem("jarvis_key");
if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API KEY:");
  localStorage.setItem("jarvis_key", API_KEY);
}

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash-latest",
  "gemini-3.0-pro"
];

// ===== 2. MEMORY SYSTEM =====
let MEMORY = JSON.parse(localStorage.getItem("jarvis_memory") || "[]");
const chatDiv = document.getElementById("chat");
const promptInput = document.getElementById("prompt");

function saveMemory() {
  localStorage.setItem("jarvis_memory", JSON.stringify(MEMORY));
}

function renderMemory() {
  chatDiv.innerHTML = "";
  MEMORY.forEach(m => {
    const div = document.createElement("div");
    div.className = "msg " + m.role;
    div.innerText = `${m.role === 'user' ? 'YOU' : 'J.A.R.V.I.S'}: ${m.text}`;
    chatDiv.appendChild(div);
  });
  chatDiv.scrollTop = chatDiv.scrollHeight;
}
renderMemory();

// Helpers for Tools & Agent Mode
function add(text, role){
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerText = text;
  chatDiv.appendChild(div);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}
async function fetchToolJson(url, options={}, timeoutMs=10000){
  const controller = new AbortController();
  const id = setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const res = await fetch(url,{...options, signal:controller.signal});
    clearTimeout(id);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(e){ clearTimeout(id); throw e; }
}

 // ===== 3. TOOLS (REAL DATA) =====
let FAV_SONG = localStorage.getItem("jarvis_fav_song") || "Kesariya";
let USER_CITY = localStorage.getItem("jarvis_city") || "Banpur, Odisha";

async function getRealWeather(city = USER_CITY){
  try{
    const geo = await fetchToolJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const loc = geo?.results?.[0];
    if(!loc) return `Weather not found for ${city}`;
    const weather = await fetchToolJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
    const c = weather.current;
    const d = weather.daily;
    let cond = "Clear";
    if(c.weather_code > 50) cond = "Cloudy / Rainy";
    else if(c.weather_code > 20) cond = "Partly Cloudy";
    return `City: ${loc.name}, ${loc.country}. Current: ${c.temperature_2m}°C, ${cond}. Max Today: ${d.temperature_2m_max[0]}°C, Min: ${d.temperature_2m_min[0]}°C. Humidity ${c.relative_humidity_2m}%, Wind ${c.wind_speed_10m} km/h, Rain Chance ${d.precipitation_probability_max[0]}%`;
  }catch(e){ return "Weather API busy hai."; }
}

async function handleTools(text){
  const lower = text.toLowerCase();
  if(lower.includes("weather") || lower.includes("mausam") || lower.includes("tapman")){
    return await getRealWeather();
  }
  // ... tumhare baaki gaane wale tools waise hi rahenge
  const playMatch=text.match(/^\s*play\s+(.+)/i);
  if(playMatch){ window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(playMatch[1]),'_blank'); return `Playing ${playMatch[1]}`; }
  if(lower.includes("open youtube")){ window.open('https://youtube.com','_blank'); return 'Opening YouTube'; }
  if(lower.includes("open google")){ window.open('https://google.com','_blank'); return 'Opening Google'; }
  return null;
}

// ===== 3.5. AGENT MODE ENGINE - REAL DATE LOCK =====
const AGENT_TOOLS = {
  time: async () => {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' };
    const ist = now.toLocaleString('en-IN', options);
    const iso = now.toISOString();
    return `REAL CURRENT DATE & TIME (IST): ${ist}. ISO: ${iso}. TODAY IS ${now.toLocaleDateString('en-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}. Use this date only. Today is NOT May 24, 2024.`;
  },
  weather: async () => { return await getRealWeather(); },
  system: async () => { return `System Status: All systems online, Battery OK, Devices ready.`; }
};

function isAgentModeRequest(text=''){
  const t = text.toLowerCase();
  return t.includes("morning briefing") || t.includes("briefing") || t.includes("aaj ka mausam") || t.includes("aaj ka date");
}

async function runAgent(goal){
  add('J.A.R.V.I.S: Fetching live briefing sir...','ai');
  
  // Real data fetch pehle
  const timeData = await AGENT_TOOLS.time();
  const weatherData = await AGENT_TOOLS.weather();
  const systemData = await AGENT_TOOLS.system();

  add(`J.A.R.V.I.S: ${timeData}`,'ai');
  add(`J.A.R.V.I.S: ${weatherData}`,'ai');

  // Ab Gemini ko bolo isi data se briefing banaye
  const finalPrompt = `
  User Goal: ${goal}
  
  YOU MUST USE THIS LIVE DATA ONLY - DO NOT INVENT DATE:
    1. ${timeData}
    2. ${weatherData}
    3. ${systemData}

  INSTRUCTIONS:
    - Morning briefing banao Hinglish me.
    - Date: Upar diye gaye REAL CURRENT DATE ka use karo. Kabhi bhi random mat likhna.
    - Weather: Upar diye gaye real weather ka use karo. Kabhi bhi [Insert Temp] ya [68°F] jaise bracket mat use karna.
    - Schedule: Agar calendar nahi hai to likho "No meetings synced, Boss. Tell me your tasks for today."
    - Markets: Simple rakhna.
    - NO SQUARE BRACKETS [] AT ALL.
    - Format same rakho jaise screenshot me hai: ### Weather & Environment etc.
  `;

  return await callGemini(finalPrompt);
}

// ===== 4. CORE BRAIN (GEMINI CALL) =====
async function callGemini(text, imageBase64 = null) {
  const contents = [...MEMORY.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }]
  })), {
    role: "user",
    parts: imageBase64 
      ? [{ text: text }, { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }]
      : [{ text: text }]
  }];
  for (let MODEL of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: contents }) }
      );
      const data = await res.json();
      if (data.candidates && data.candidates[0]) {
        return data.candidates[0].content.parts[0].text;
      } else if (data.error) { throw new Error(data.error.message); }
    } catch (e) { console.log(`${MODEL} failed: ${e.message}`); continue; }
  }
  throw new Error("All models failed");
}

// ===== 5. MAIN EXECUTE FUNCTION =====
async function execute() {
  const text = promptInput.value.trim();
  if (!text && !window.tempImage) return;

  const displayText = text || "What do you see? Describe this image.";
  
  MEMORY.push({ role: "user", text: displayText });
  renderMemory();
  promptInput.value = "";
  document.getElementById("status").innerText = "BRAIN: PROCESSING...";

  try {
    const reply = await callGemini(displayText, window.tempImage || null);
    MEMORY.push({ role: "model", text: reply });
    saveMemory();
    renderMemory();
    speak(reply);
    document.getElementById("status").innerText = "BRAIN: ONLINE";
    document.getElementById("status").style.color = "#0f0";
  } catch (err) {
    document.getElementById("status").innerText = "ERROR";
    chatDiv.innerText += `\nERROR: ${err.message}`;
  }
  window.tempImage = null;
}

document.getElementById("send-btn").onclick = execute;
promptInput.addEventListener("keypress", e => { if(e.key === 'Enter') execute(); });
document.getElementById("clear-btn").onclick = () => {
  if(confirm("Clear Memory?")) {
    MEMORY = [];
    saveMemory();
    chatDiv.innerHTML = "SYSTEM: Memory Cleared";
  }
};

// ===== 6. VOICE & VISION =====
const micBtn = document.getElementById("mic-btn");
let recognition;
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.onresult = (e) => {
    promptInput.value = e.results[0][0].transcript;
    execute();
  };
  recognition.onend = () => micBtn.classList.remove("active");
}

micBtn.onclick = () => {
  if(recognition) {
    recognition.start();
    micBtn.classList.add("active");
    document.getElementById("status").innerText = "LISTENING...";
  }
};

// Image Input Logic
document.getElementById("img-btn").onclick = () => document.getElementById("img-input").click();
document.getElementById("img-input").onchange = (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    window.tempImage = ev.target.result.split(",")[1];
    promptInput.value = "What do you see? Describe this image in detail";
    execute();
  };
  reader.readAsDataURL(file);
};

function speak(text) {
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.9; utter.pitch = 1.0;
    speechSynthesis.speak(utter);
  }
   }
