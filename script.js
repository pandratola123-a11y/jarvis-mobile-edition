 // ===== 1. API KEY =====
let GEMINI_API_KEY = localStorage.getItem('JARVIS_KEY');
function getKey() {
  if (!GEMINI_API_KEY) {
    let k = prompt("🔑 Apni Gemini API Key daalo:");
    if (k) {
      GEMINI_API_KEY = k.trim();
      localStorage.setItem('JARVIS_KEY', GEMINI_API_KEY);
    }
  }
  return GEMINI_API_KEY;
}
getKey();

 // ===== 1.5 MEMORY & VISION (SUPER FINAL V2 - ALL MEMORY) =====
let memory = JSON.parse(localStorage.getItem('jarvis_memory') || "[]");
let camStream = null;
let userFacts = JSON.parse(localStorage.getItem('jarvis_facts') || '{}');

function saveMemory(t){
  memory.push({time: new Date().toLocaleString(), text: t});
  localStorage.setItem('jarvis_memory', JSON.stringify(memory));
}
function saveFacts(){
  localStorage.setItem('jarvis_facts', JSON.stringify(userFacts));
}
function checkAndStoreMemory(text) {
  let low = text.toLowerCase();
  let match = low.match(/my (?:favourite|favorite) (.+?) is (.+)/);
  if(match){
    let key = match[1].trim().replace('my','').trim();
    let value = text.split(/is/i).pop().trim();
    userFacts[key] = value;
    saveFacts();
    return true;
  }
  return false;
}
function getAnswer(text) {
  let low = text.toLowerCase();
  let match = low.match(/(?:what|which)(?:.*?)my (?:favourite|favorite) (.+?)\??$/);
  if(match){
    let key = match[1].trim().replace('one is','').replace('is','').trim();
    if(userFacts[key]){
      return `Your favourite ${key} is ${userFacts[key]}, Sir. I remember it.`;
    }
  }
  return null;
}

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic');
const clearBtn = document.getElementById('clear');
const camBtn = document.getElementById('cam');
const imgInput = document.getElementById('img-input');

function add(t,w){
  const d=document.createElement('div');
  d.className="msg "+w;
  d.innerText=t;
  chat.appendChild(d);
  chat.scrollTop=chat.scrollHeight;
  return d;
}

// ===== 2. ASK GEMINI =====
async function askGemini(q){
  if(!q) return;
  const key = getKey();
  const thinking = add("J.A.R.V.I.S. Thinking... ", 'ai');
  try{
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`,{
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({contents: [{parts: [{text: q}]}]})
    });
    const data = await res.json();
    if(data.error) throw new Error(data.error.message);
    const reply = data.candidates[0].content.parts[0].text;
    thinking.innerText = "J.A.R.V.I.S : " + reply;
    speak(reply);
  }catch(e){
    thinking.innerText = "J.A.R.V.I.S. ERROR : " + e.message;
  }
}

// ===== 3. MIC =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if(SR){
  const rec = new SR();
  rec.lang = 'en-US';
  rec.onresult = (e)=>{
    const t = e.results[0][0].transcript;
    add(t, 'user');
    handleInput(t);
  };
  micBtn.onclick = ()=>{
    rec.start();
    micBtn.innerText = 'LISTENING....';
  };
  rec.onend = ()=>{micBtn.innerText = '🎤';};
}

// ===== 4. VOICE =====
let voices=[];
function loadVoices(){ voices=speechSynthesis.getVoices();}
loadVoices();
speechSynthesis.onvoiceschanged=loadVoices;
function speak(t){
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.rate=1.05; u.pitch=0.85;
  u.voice = voices.find(v=>v.lang.includes('en-IN')) || voices.find(v=>v.lang.startsWith('en'));
  if(u.voice){ speechSynthesis.speak(u); }
}

// ===== 5. SEND BUTTON =====
sendBtn.onclick = ()=>{
  const q = input.value.trim();
  if(!q) return;
  add(q, "user");
  input.value="";
  handleInput(q);
};
input.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){ sendBtn.click(); }
});

 // ===== 6. LOCAL COMMANDS (FINAL FIXED) =====
function handleInput(q){
  const low = q.toLowerCase();
 
  let storedMsg = checkAndStoreMemory(q);
  if(storedMsg){
    add(storedMsg, 'ai');
    speak(storedMsg);
    return;
  }
 
  let factAns = getAnswer(q);
  if(factAns){
    add(factAns, 'ai');
    speak(factAns);
    return;
  }

  if(low.includes("time")){
    const t = new Date().toLocaleTimeString();
    add("Current time is " + t, 'ai'); speak(t); return;
  }
  if(low.includes("date")){
    const d = new Date().toDateString();
    add("Today is " + d, 'ai'); speak(d); return;
  }
  if(low.includes("youtube")){ window.open("https://youtube.com","_blank"); add("Opening YouTube, Sir.", 'ai'); return; }
  if(low.includes("google")){ window.open("https://google.com","_blank"); add("Opening Google, Sir.", 'ai'); return; }

  if(low.includes("clear memory")){
    localStorage.removeItem('jarvis_memory');
    localStorage.removeItem('jarvis_facts');
    add("Memory cleared, Sir. All facts cleared.", 'ai'); speak("Memory cleared"); return;
  }
  if(low.includes("camera on") || low.includes("vision on")){
    add("Vision Online, Sir. Camera starting...", 'ai'); 
    startVision();
    return;
  }
 
  askGemini(q);
}

// ===== 7. EXTRA + WELCOME =====
input.addEventListener('keypress', e=>{ if(e.key==='Enter') sendBtn.click(); });
add("System Online. I am JARVIS, Sir. How can I help you?", 'ai');
