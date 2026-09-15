// ===== 1. SETUP =====
const MINI_API_KEY = localStorage.getItem("jarvis_key") || prompt("Apni Gemini API Key dalo:");
if(MINI_API_KEY) localStorage.setItem("jarvis_key", MINI_API_KEY);
const input = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic');

function addMsg(text, who){
  const div = document.createElement('div');
  div.style.margin="10px"; div.style.padding="10px";
  div.style.borderRadius="8px";
  div.style.border="1px solid #00ffff";
  div.style.color = who==='user'? '#fff' : '#00ffff';
  div.innerText = (who==='user'? 'YOU: ' : 'J.A.R.V.I.S: ') + text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

// ===== 2. ASK GEMINI =====
async function askGemini(q){
  if(!q) return;
  const thinking = addMsg("Thinking...", 'jarvis');
  try{
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${MINI_API_KEY}`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({contents:[{parts:[{text: q}]}]})
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
    addMsg(t, 'user');
    handleInput(t);
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
  const u = new SpeechSynthesisUtterance(t);
  u.rate=1.05; u.pitch=0.85;
  const v = voices.find(v=>v.lang.startsWith('en'));
  if(v) u.voice=v;
  speechSynthesis.speak(u);
}

// ===== 5. SEND BUTTON =====
document.getElementById('send').onclick=()=>{
  const q = input.value.trim();
  if(!q) return;
  addMsg(q, 'user');
  input.value='';
  handleInput(q);
};

// ===== 6. LOCAL COMMANDS + SMART ROUTING =====
function handleInput(q){
  const low = q.toLowerCase();
  if(low.includes("time")){
    const t = new Date().toLocaleTimeString();
    addMsg("Current time is " + t, 'jarvis'); speak(t); return;
  }
  if(low.includes("date")){
    const d = new Date().toDateString();
    addMsg("Today is " + d, 'jarvis'); speak(d); return;
  }
  if(low.includes("youtube")){ window.open("https://youtube.com","_blank"); addMsg("Opening YouTube, Sir.", 'jarvis'); return; }
  if(low.includes("google")){ window.open("https://google.com","_blank"); addMsg("Opening Google, Sir.", 'jarvis'); return; }
  askGemini(q);
}

// ===== 7. EXTRA + WELCOME =====
input.addEventListener('keypress', e=>{ if(e.key==='Enter') sendBtn.click(); });
addMsg("System Online. I am JARVIS, Sir.", 'jarvis');
