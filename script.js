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
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`,{
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

// ===== 6. LOCAL COMMANDS =====
function handleInput(q){
  const low = q.toLowerCase();
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
  askGemini(q);
}

// ===== 7. WELCOME =====
add("System Online. I am JARVIS, Sir. How can I help you?", 'ai');

// ===== 2. ASK GEMINI =====
async function askGemini(q){
  if(!q) return;
  const key = getKey();
  const thinking = add('J.A.R.V.I.S: Thinking...','ai');
  try{
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-leatest:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: q }] }] })
    });
    const data = await res.json();
    if(data.error) throw new Error(data.error.message);
    const reply = data.candidates[0].content.parts[0].text;
    thinking.innerText = 'J.A.R.V.I.S: ' + reply;
    speak(reply);
  }catch(e){
    thinking.innerText = 'J.A.R.V.I.S: ERROR - ' + e.message;
  }
}

// ===== 3. MIC / SPEECH RECOGNITION =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if(SR){
  const rec = new SR();
  rec.lang = 'en-US';
  rec.onresult = (e)=>{
    const t = e.results[0][0].transcript;
    add(t, 'user');
    askGemini(t);
  };
  micBtn.onclick = ()=>{
    rec.start();
    micBtn.innerText = 'LISTENING....';
  };
  rec.onend = ()=>{ micBtn.innerText = '🎤'; };
}

 // ===== 4. VOICE =====
let voices=[];
function loadVoices(){ voices=speechSynthesis.getVoices(); }
loadVoices();
speechSynthesis.onvoiceschanged=loadVoices;
function speak(t){
  speechSynthesis.cancel(); // purani voice ko rok do
  const u = new SpeechSynthesisUtterance(t);
  u.rate=1.05; u.pitch=0.85;
  const v = voices.find(v=>v.lang.includes('en-IN')) || voices.find(v=>v.lang.startsWith('en'));
  if(v) u.voice=v;
  speechSynthesis.speak(u);
}

 // ===== 5. SEND BUTTON + ENTER KEY =====
sendBtn.onclick=()=>{
  const q = input.value.trim();
  if(!q) return;
  add(q, 'user');
  input.value='';
  askGemini(q);
};

input.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    sendBtn.onclick();
  }
});

// ===== 6. LOCAL COMMANDS + SMART ROUTING =====
function handleInput(q){
  const low = q.toLowerCase();
  if(low.includes("time")){
    const t = new Date().toLocaleTimeString();
    add("Current time is " + t, 'ai'); speak(t); return;
  }
  if(low.includes("date")){
    const d = new Date().toDateString();
    add("Today is " + d, 'ai'); speak(t); return;
  }
  if(low.includes("youtube")){ window.open("https://youtube.com","_blank"); add("Opening YouTube, Sir.", 'ai'); return; }
  if(low.includes("google")){ window.open("https://google.com","_blank"); add("Opening Google, Sir.", 'ai'); return; }
  askGemini(q);
}

// ===== 7. EXTRA + WELCOME =====
input.addEventListener('keypress', e=>{ if(e.key==='Enter') sendBtn.click(); });
add("System Online. I am JARVIS, Sir. How can I help you?", 'ai');
