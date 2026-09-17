// ===== 1. SETUP ===== 
localStorage.removeItem("jarvis_key");
const GEMINI_API_KEY = "TUMHARI_GEMINI_API_KEY_YAHAN_DALO";
const chat = document.getElementById('chat');
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
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
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

// ===== 6. LOCAL COMMANDS + AUTOMATION + MEMORY STORAGE =====
function handleInput(q){
  const low = q.toLowerCase();
  addMsg(q, "user");

  function save(q, a){
    let old = JSON.parse(localStorage.getItem("jarvis_memory")||"[]");
    old.push({q:q, a:a, time:new Date().toLocaleString()});
    localStorage.setItem("jarvis_memory", JSON.stringify(old));
  }

  if(low.includes("youtube")){
    const r="Opening YouTube, Sir."; addMsg(r, "jarvis"); speak(r); save(q,r);
    window.location.href="https://m.youtube.com"; return;
  }
  if(low.includes("whatsapp")){
    const r="Opening WhatsApp, Sir."; addMsg(r, "jarvis"); speak(r); save(q,r);
    window.location.href="https://wa.me/"; return;
  }
  if(low.includes("instagram")){
    const r="Opening Instagram, Sir."; addMsg(r, "jarvis"); speak(r); save(q,r);
    window.location.href="https://instagram.com"; return;
  }
  if(low.includes("google")){
    const r="Opening Google, Sir."; addMsg(r, "jarvis"); speak(r); save(q,r);
    window.location.href="https://google.com"; return;
  }
  if(low.includes("map")){
    const r="Opening Maps, Sir."; addMsg(r, "jarvis"); speak(r); save(q,r);
    window.location.href="https://maps.google.com"; return;
  }
  if(low.includes("time")){
    const r="Time is "+new Date().toLocaleTimeString()+" Sir."; addMsg(r, "jarvis"); speak(r); save(q,r); return;
  }
  if(low.includes("date")){
    const r="Today is "+new Date().toDateString()+" Sir."; addMsg(r, "jarvis"); speak(r); save(q,r); return;
  }

  // Agar koi command nahi mila toh AI se pucho
  askGemini(q).then(reply=>{
    save(q, reply);
  });
}

// ===== 7. WELCOME =====
document.getElementById("input").addEventListener("keypress", (e)=>{ if(e.key=="Enter") document.getElementById("send").click(); });
addMsg("System Online. I am JARVIS, Sir.", "jarvis");
