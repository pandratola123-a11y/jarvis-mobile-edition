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

 // ===== 3. TOOLS (15 TOOLS) =====
async function handleTools(text){
  if(/^\s*(?:please\s+)?(?:open\s+youtube|youtube\s+open|youtube)(?:\s+please)?[.!?]*\s*$/i.test(text)){
    window.open('https://youtube.com','_blank','noopener,noreferrer');
    return 'Opening YouTube, Boss.';
  }
  if(/^\s*(?:please\s+)?(?:open\s+google|google\s+open|google)(?:\s+please)?[.!?]*\s*$/i.test(text)){
    window.open('https://google.com','_blank','noopener,noreferrer');
    return 'Opening Google, Boss.';
  }
  const urlCommand=text.match(/^\s*(?:open|visit|go to)\s+(https?:\/\/\S+)\s*$/i);
  if(urlCommand){
    try{
      const destination=new URL(urlCommand[1]);
      window.open(destination.href,'_blank','noopener,noreferrer');
      return 'Opening '+destination.hostname+', Boss.';
    }catch(e){ return 'That link does not look valid.'; }
  }
  const googleSearch=text.match(/^\s*(?:google\s+search|search\s+(?:on\s+)?google)(?:\s+for)?\s+(.+?)\s*$/i);
  if(googleSearch){
    window.open('https://www.google.com/search?q='+encodeURIComponent(googleSearch[1]),'_blank','noopener,noreferrer');
    return 'Searching Google for '+googleSearch[1]+', Boss.';
  }
  const playMatch=text.match(/^\s*play\s+(.+?)\s*$/i);
  const youtubeMatch=text.match(/^\s*youtube(?:\s+search)?(?:\s+for)?\s+(.+?)\s*$/i);
  const searchYoutubeMatch=text.match(/^\s*search\s+(?:on\s+)?youtube(?:\s+for)?\s+(.+?)\s*$/i);
  const videoQuery=(playMatch||youtubeMatch||searchYoutubeMatch)?.[1]?.trim();
  if(videoQuery){
    window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(videoQuery),'_blank','noopener,noreferrer');
    return 'Searching YouTube for '+videoQuery+', Boss.';
  }
  const searchMatch=text.match(/^\s*(?:search|look up)\s+(?:for\s+)?(.+?)\s*$/i);
  if(searchMatch){
    try{
      const url='https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+encodeURIComponent(searchMatch[1])+'&format=json&origin=*';
      const data=await fetchToolJson(url);
      const result=data?.query?.search?.[0];
      if(!result) return 'I could not find that, Boss.';
      return 'Wikipedia: '+result.title+'. '+String(result.snippet||'').replace(/<[^>]*>/g,'');
    }catch(e){ return 'Search error, Boss.'; }
  }
  return null;
}

// ===== 3.5. AGENT MODE ENGINE =====
const AGENT_TOOLS = Object.freeze({
  time: async () => new Date().toString(),
  weather: async () => 'Weather checked',
  news: async () => 'Latest Tech News',
  crypto: async () => 'Bitcoin price'
});
function isAgentModeRequest(text=''){
  return /\b(?:agent(?:\s+mode)?|briefing|research|analysis)\b/i.test(text);
}
async function runAgent(goal){
  add('J.A.R.V.I.S: Agent mode active. Goal: '+goal,'ai');
  const results={};
  for(const tool of ['time','weather']){
    add('J.A.R.V.I.S: Running '+tool+'...','ai');
    results[tool]=await AGENT_TOOLS[tool]();
  }
  const summaryPrompt='Goal: '+goal+'. Results: '+JSON.stringify(results)+'. Give summary.';
  return await callGemini(summaryPrompt);
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
