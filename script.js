// ===== 1. SETUP =====
const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic');
const apiBox = document.getElementById('api-box');

function getKey(){ return localStorage.getItem('GEMINI_KEY'); }
function saveKey(){
  const k = document.getElementById('api-input').value.trim();
  if(!k){ alert('Key khali hai'); return; }
  localStorage.setItem('GEMINI_KEY', k);
  location.reload();
}
setTimeout(()=>{ if(!getKey() && apiBox) apiBox.style.display='block'; }, 800);

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
  const GEMINI_API_KEY = getKey();
  if(!GEMINI_API_KEY){ if(apiBox) apiBox.style.display='block'; throw new Error('Pehle API Key daalo'); }
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
    return reply;
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
    handleInput(t);
  };
  micBtn.onclick = ()=>{
    rec.start();
    micBtn.innerText = 'LISTENING...';
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

// ===== 5. LOCAL COMMANDS + AUTOMATION + MEMORY =====
function handleInput(q){
  const low = q.toLowerCase();
  addMsg(q, "user");
  function save(q, a){
    let old = JSON.parse(localStorage.getItem("jarvis_memory")||"[]");
    old.push({q:q, a:a, time:new Date().toLocaleString()});
    localStorage.setItem("jarvis_memory", JSON.stringify(old));
  }

  if(low.includes("go home") || low.includes("home jao")){
    const r="Going Home, Sir."; addMsg(r, "jarvis"); speak(r); save(q,r);
    window.history.back(); return;
  }

  // DYNAMIC INSTAGRAM SEARCH - Koi bhi naam
  if(low.includes("instagram")){
    // "instagram par rahul search karo" -> rahul nikal lega
    // "sarita ko instagram me search karo" -> sarita nikal lega
    let keyword = q.toLowerCase()
      .replace("instagram","")
      .replace("par","").replace("pe","").replace("me","").replace("on","")
      .replace("search","").replace("karo","").replace("kar","").replace("ko","")
      .replace("open","").replace("kholo","")
      .trim();
    
    if(keyword){
      const r=`Searching ${keyword} on Instagram, Sir.`; addMsg(r, "jarvis"); speak(r); save(q,r);
      window.location.href = `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(keyword)}`; 
      return;
    } else {
      const r="Opening Instagram, Sir."; addMsg(r, "jarvis"); speak(r); save(q,r);
      window.location.href="https://www.instagram.com"; return;
    }
  }

  if(low.includes("youtube")){
    let kw = q.toLowerCase().replace("youtube","").replace("par","").replace("pe","").replace("search","").replace("karo","").replace("open","").trim();
    if(kw){ 
      window.location.href=`https://m.youtube.com/results?search_query=${encodeURIComponent(kw)}`; return; 
    }
    window.location.href="https://m.youtube.com"; return;
  }

  if(low.includes("time")){ const r="Time is "+new Date().toLocaleTimeString()+" Sir."; addMsg(r, "jarvis"); speak(r); save(q,r); return; }
  if(low.includes("date")){ const r="Today is "+new Date().toDateString()+" Sir."; addMsg(r, "jarvis"); speak(r); save(q,r); return; }
  
  askGemini(q).then(reply=>{ if(reply) save(q, reply); });
}
 

// ===== 6. WELCOME + SEND =====
document.getElementById('send').onclick=()=>{
  const q = input.value.trim();
  if(!q) return;
  input.value='';
  handleInput(q);
};
document.getElementById('msg').addEventListener("keypress", (e)=>{ if(e.key=="Enter") document.getElementById("send").click(); });
addMsg("System Online. I am JARVIS, Sir.", "jarvis");
