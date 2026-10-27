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

// ===== 3. REAL TOOLS =====
let USER_CITY = localStorage.getItem("jarvis_city") || "Banpur";
async function getRealWeather(city = USER_CITY){
  try{
    const geo = await fetchToolJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const loc = geo?.results?.[0]; if(!loc) return `Weather not found for ${city}`;
    const w = await fetchToolJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
    const c=w.current, d=w.daily;
    let cond="Clear"; if(c.weather_code>50) cond="Cloudy / Rainy"; else if(c.weather_code>20) cond="Partly Cloudy";
    return `Weather in ${loc.name}: Now ${c.temperature_2m}°C (${cond}), Max ${d.temperature_2m_max[0]}°C / Min ${d.temperature_2m_min[0]}°C, Humidity ${c.relative_humidity_2m}%, Wind ${c.wind_speed_10m} km/h, Rain Chance ${d.precipitation_probability_max[0]}%`;
  }catch(e){ return "Weather API busy."; }
}
async function handleTools(text){
  const lower=text.toLowerCase();
  if(lower.includes("weather")||lower.includes("mausam")){ return await getRealWeather(); }
  if(lower.includes("open youtube")){ window.open('https://youtube.com','_blank'); return 'Opening YouTube, Boss.'; }
  if(lower.includes("open google")){ window.open('https://google.com','_blank'); return 'Opening Google, Boss.'; }
  const play=text.match(/play\s+(.+)/i); if(play){ window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(play[1]),'_blank'); return `Playing ${play[1]} on YouTube`; }
  return null;
}

// ===== 3.5. AGENT MODE - REAL DATE LOCK =====
function isAgentModeRequest(text=''){
  const t=text.toLowerCase();
  return t.includes("morning briefing") || t.includes("morning report") || t.includes("aaj ka") || t.includes("briefing");
}
async function runAgent(goal){
  const now=new Date();
  const istString=now.toLocaleString('en-IN',{timeZone:'Asia/Kolkata', weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'});
  const dateOnly=now.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata', weekday:'long', year:'numeric', month:'long', day:'numeric'});
  
  add(`J.A.R.V.I.S: Fetching live data for ${dateOnly}...`,'ai');
  const weatherData=await getRealWeather();
  
  const finalPrompt = `
  LIVE DATA - YOU MUST USE THIS:
    - REAL DATE TODAY IS: ${istString} (Asia/Kolkata). Today is ${dateOnly}. NEVER USE May 24, 2024.
    - REAL WEATHER: ${weatherData}
    - SYSTEM: All devices charged, Battery OK.

  TASK: User said: "${goal}"
  Create Morning Briefing. Language: User wrote "though" meaning in English, so give briefing in English. If user writes Hindi, give Hinglish.
  STRUCTURE:
  Good morning, sir. Systems are online.
  Here is your morning briefing for **${dateOnly}**:
  ### Weather & Environment - use REAL WEATHER above
  ### Schedule & Priorities - say "No calendar synced, tell me your 3 top priorities Boss"
  ### Markets & News - keep short
  ### System Status - All charged
  
  RULES: NO [brackets] like [Insert Temp]. NO [Time] - [Event]. Use real data only.
  `;

  return await callGemini(finalPrompt);
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
