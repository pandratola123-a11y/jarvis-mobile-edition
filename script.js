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

 // ===== 3. TOOLS (REAL DATA) - UPDATED GPS =====
let FAV_SONG = localStorage.getItem("jarvis_fav_song") || "";
let USER_CITY = localStorage.getItem("jarvis_city") || "Rayagada";

// NEW TOOL - REAL GPS + COMPASS + WEATHER (Latitude, Altitude, Heading)
const getLiveGPSWeather = () => {
  return new Promise(async (resolve) => {
    if (!navigator.geolocation) {
      resolve("GPS supported nahi hai is device me.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const alt = pos.coords.altitude ? `${pos.coords.altitude.toFixed(0)}m` : "N/A";
        const acc = pos.coords.accuracy.toFixed(0);
        let heading = pos.coords.heading ? `${pos.coords.heading.toFixed(0)}°` : "N/A (moving par milega)";

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=Asia/Kolkata`;
        const data = await fetchToolJson(url);
        const c = data.current;
        const d = data.daily;

        let cond = "Clear";
        if(c.weather_code > 1 && c.weather_code < 4) cond = "Partly Cloudy";
        if(c.weather_code >= 45) cond = "Cloudy / Rainy";

        resolve(`REAL GPS LOCATION: Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}, Alt ${alt}, Accuracy ${acc}m, Compass Heading ${heading}. WEATHER: ${c.temperature_2m}°C, ${cond}, Wind ${c.wind_speed_10m}km/h, Max Today ${d.temperature_2m_max[0]}°C`);
      } catch (e) {
        resolve(`GPS mil gaya Lat ${pos.coords.latitude}, Lon ${pos.coords.longitude} par weather fail.`);
      }
    }, (err) => {
      resolve(`GPS Permission do Boss! Error: ${err.message}`);
    }, { enableHighAccuracy: true, timeout: 10000 });
  });
};

async function handleTools(text){
  const lower = text.toLowerCase();
  if(lower.includes("weather") || lower.includes("mausam")){
    return await getLiveGPSWeather();
  }
  if(lower.includes("song") || lower.includes("play")){
    if(FAV_SONG) window.open(FAV_SONG, '_blank');
    return FAV_SONG ? `Playing your fav song...` : `Kaunsa gaana bajau?`;
  }
  return null;
}

// ===== 3.5. AGENT MODE ENGINE - REAL DATE + GPS LOCK (NEW FIXED) =====
const AGENT_TOOLS = {
  time: async () => {
    try {
      const res = await fetch("https://worldtimeapi.org/api/timezone/Asia/Kolkata");
      const data = await res.json();
      const now = new Date(data.datetime);
      const ist = now.toLocaleString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour:'2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata' });
      return `REAL CURRENT DATE & TIME (IST): ${ist}. ISO: ${data.datetime}. TODAY IS ${ist}.`;
    } catch (e) {
      const now = new Date();
      return `REAL CURRENT DATE & TIME (IST Fallback): ${now.toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})}`;
    }
  },
  location_weather: async () => { return await getLiveGPSWeather(); },
  system: async () => { return `System Status: All systems online, Battery OK.`; }
};

function isAgentModeRequest(text=''){
  const t = text.toLowerCase();
  return t.includes("morning briefing") || t.includes("briefing") || t.includes("aaj ka");
}

async function runAgent(goal){
  add('J.A.R.V.I.S: GPS + Weather lock kar raha hu sir...','ai');
  const timeData = await AGENT_TOOLS.time();
  const locWeatherData = await AGENT_TOOLS.location_weather();
  const systemData = await AGENT_TOOLS.system();
  
  const finalPrompt = `
  User Goal: ${goal}
  LIVE DATA - YOU MUST USE ONLY THIS:
    1. ${timeData}
    2. ${locWeatherData}
    3. ${systemData}

  INSTRUCTIONS:
    - Morning briefing banao Hinglish me.
    - Date ke liye sirf LIVE DATA 1 use karo.
    - Location, Latitude, Altitude, Compass, Weather ke liye LIVE DATA 2 use karo.
    - Bracket [] kabhi mat use karna.
    - Format: ### Date, ### Location & GPS, ### Weather & Environment
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

 // ===== 5. MAIN EXECUTE FUNCTION (CORRECTED - TOOL FIRST) =====
async function execute() {
  const text = promptInput.value.trim();
  if (!text && !window.tempImage) return;

  const displayText = text || "What do you see? Describe this image.";
  
  MEMORY.push({ role: "user", text: displayText });
  renderMemory();
  add(`J.A.R.V.I.S: ${displayText}`, 'user');
  promptInput.value = "";
  document.getElementById("status").innerText = "BRAIN: PROCESSING...";

  try {
    let reply = null;

    // STEP 1: AGENT MODE CHECK - SABSE PEHLE
    if (isAgentModeRequest(displayText)) {
      document.getElementById("status").innerText = "BRAIN: AGENT MODE...";
      reply = await runAgent(displayText);
    } else {
      // STEP 2: NORMAL TOOLS CHECK
      const toolResult = await handleTools(displayText);
      if (toolResult) {
        reply = toolResult;
      } else {
        // STEP 3: TABHI GEMINI PE JAO
        reply = await callGemini(displayText, window.tempImage || null);
      }
    }

    MEMORY.push({ role: "model", text: reply });
    saveMemory();
    renderMemory();
    add(`J.A.R.V.I.S: ${reply}`, 'ai');
    speak(reply);
    document.getElementById("status").innerText = "BRAIN: ONLINE";
    document.getElementById("status").style.color = "#0f0";
  } catch (err) {
    document.getElementById("status").innerText = "ERROR";
    add(`J.A.R.V.I.S: ERROR: ${err.message}`, 'ai');
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
    localStorage.removeItem("jarvis_memory");
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
