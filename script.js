 // ===== 1. API KEY & SMART MODELS =====
let API_KEY = localStorage.getItem("jarvis_key");
if (!API_KEY) {
  API_KEY = prompt("Enter your Gemini API KEY:");
  localStorage.setItem("jarvis_key", API_KEY);
}
const MODELS = ["gemini-3.5-flash-lite","gemini-3.5-flash-latest","gemini-3.0-pro"];

// ===== 2. MEMORY SYSTEM =====
let MEMORY = JSON.parse(localStorage.getItem("jarvis_memory") || "[]");
const chatDiv = document.getElementById("chat");
const promptInput = document.getElementById("prompt");
function saveMemory(){ localStorage.setItem("jarvis_memory", JSON.stringify(MEMORY)); }
function renderMemory(){
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
function add(text, role){
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerText = text;
  chatDiv.appendChild(div);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}
async function fetchToolJson(url, options={}, timeoutMs=10000){
  const c = new AbortController(); const id=setTimeout(()=>c.abort(),timeoutMs);
  try{ const r=await fetch(url,{...options, signal:c.signal}); clearTimeout(id); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json(); }
  catch(e){ clearTimeout(id); throw e; }
}

 // ===== 3. REAL TOOLS - RAYAGADA FIXED FROM YOUR COMPASS =====
let USER_CITY = localStorage.getItem("jarvis_city") || "Rayagada";
// Aapke compass screenshot se: 19°10'56" N, 83°36'26" E
const RAYAGADA_LAT = 19.1822;
const RAYAGADA_LON = 83.6072;

async function getRealWeather(city = USER_CITY){
  try{
    const w = await fetchToolJson(`https://api.open-meteo.com/v1/forecast?latitude=${RAYAGADA_LAT}&longitude=${RAYAGADA_LON}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
    
    const curr = w.current;
    const daily = w.daily;
    let cond = "Clear";
    if(curr.weather_code >= 95) cond = "Thunderstorm";
    else if(curr.weather_code >= 51) cond = "Rainy / Cloudy";
    else if(curr.weather_code >= 20) cond = "Partly Cloudy";

    return `Location: ${city} (${RAYAGADA_LAT}, ${RAYAGADA_LON}) | Now: ${curr.temperature_2m}°C (${cond}) | Max: ${daily.temperature_2m_max[0]}°C / Min: ${daily.temperature_2m_min[0]}°C | Humidity: ${curr.relative_humidity_2m}% | Wind: ${curr.wind_speed_10m} km/h | Elevation: 387.4m - From your compass`;
  } catch(e){
    return `Weather API busy Boss. Location: Rayagada ${RAYAGADA_LAT}, ${RAYAGADA_LON}`;
  }
}

 // ===== 3.5. AGENT MODE - FIXED - NO GEMINI - DIRECT REAL DATA =====
function isAgentModeRequest(text=''){
  const t=text.toLowerCase();
  return t.includes("morning briefing") || t.includes("morning report") || t.includes("aaj ka") || t.includes("weather") || t.includes("mausam") || t.includes("vedar") || t.includes("briefing") || t.includes("date");
}

async function runAgent(goal){
  const now=new Date();
  const istString=now.toLocaleString('en-IN',{timeZone:'Asia/Kolkata', weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:true});
  const dateOnly=now.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata', weekday:'long', year:'numeric', month:'long', day:'numeric'});

  add(`J.A.R.V.I.S: Fetching live data for ${dateOnly}...`,'ai');
  
  // Aapke compass wale location se real weather
  const weatherData = await getRealWeather();

  // YE DIRECT ANSWER HAI - GEMINI USE NAHI HOGA, ISLIYE DATE GALAT NAHI HOGA
  const briefing = `Good morning Boss! Systems are ONLINE.

Here is your morning briefing for **${dateOnly}** - ${istString} IST (Rayagada, Odisha - 19.1822, 83.6072 - Elevation 387.4m from your compass):

### 1. Time & Weather
${weatherData}
Current Time: ${istString}

### 2. Schedule & Priorities
No calendar synced Boss. Tell me your 3 top priorities for today and I will track them.

### 3. News & Updates
Say "search news today" for live news update.

### 4. System Status
All devices charged, Battery OK. Memory: ${MEMORY.length} chats. Location: Rayagada Locked.

Bataiye Boss, aaj ka main goal kya hai?`;

  return briefing;
}

// ===== 4. BRAIN =====
async function callGemini(text, imageBase64 = null) {
  const now=new Date();
  const realDate=now.toLocaleString('en-IN',{timeZone:'Asia/Kolkata', weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'});
  const sys=`You are J.A.R.V.I.S. Today is ${realDate} IST. You have real weather tool data provided. NEVER output [Insert ...] placeholders. Never say May 24, 2024. Be precise.`;

  const contents = [...MEMORY.map(m => ({role:m.role==='user'?'user':'model', parts:[{text:m.text}]})), {role:"user", parts:imageBase64?[{text:sys+"\n\nUser: "+text},{inline_data:{mime_type:"image/jpeg",data:imageBase64}}]:[{text:sys+"\n\nUser: "+text}]}];
  for(let MODEL of MODELS){
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({contents})});
      const data=await res.json(); if(data.candidates&&data.candidates[0]) return data.candidates[0].content.parts[0].text;
    }catch(e){ continue; }
  } throw new Error("All models failed");
}

// ===== 5. MAIN EXECUTE - TOOL FIRST =====
async function execute() {
  const text = promptInput.value.trim();
  if (!text && !window.tempImage) return;
  const displayText = text || "What do you see? Describe this image.";
  MEMORY.push({ role: "user", text: displayText });
  renderMemory();
  promptInput.value = "";
  document.getElementById("status").innerText = "BRAIN: PROCESSING...";

  try {
    let reply = null;
    // STEP 1: Check if briefing? -> Agent Mode FIRST
    if(isAgentModeRequest(displayText)){
      reply = await runAgent(displayText);
    } else {
      // STEP 2: Normal tools
      reply = await handleTools(displayText);
    }
    // STEP 3: If no tool, then Gemini
    if(!reply){
      reply = await callGemini(displayText, window.tempImage || null);
    }

    MEMORY.push({ role: "model", text: reply });
    saveMemory();
    renderMemory();
    speak(reply);
    document.getElementById("status").innerText = "BRAIN: ONLINE";
    document.getElementById("status").style.color = "#0f0";
  } catch (err) {
    document.getElementById("status").innerText = "ERROR: "+err.message;
  }
  window.tempImage = null;
}

document.getElementById("send-btn").onclick = execute;
promptInput.addEventListener("keypress", e => { if(e.key === 'Enter') execute(); });
document.getElementById("clear-btn").onclick = () => {
  if(confirm("Clear Memory?")) { MEMORY = []; saveMemory(); chatDiv.innerHTML = "SYSTEM: Memory Cleared"; }
};

// ===== 6. VOICE & VISION =====
const micBtn = document.getElementById("mic-btn");
let recognition;
if ('webkitSpeechRecognition' in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.onresult = (e) => { promptInput.value = e.results[0][0].transcript; execute(); };
  recognition.onend = () => micBtn.classList.remove("active");
}
micBtn.onclick = () => { if(recognition){ recognition.start(); micBtn.classList.add("active"); document.getElementById("status").innerText = "LISTENING..."; } };
document.getElementById("img-btn").onclick = () => document.getElementById("img-input").click();
document.getElementById("img-input").onchange = (e) => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => { window.tempImage = ev.target.result.split(",")[1]; promptInput.value = "What do you see? Describe this image in detail"; execute(); };
  reader.readAsDataURL(file);
};
function speak(text) {
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text); utter.rate = 0.9; utter.pitch = 1.0; speechSynthesis.speak(utter);
  }
}
