const chat = document.getElementById('chat');
const msgInput = document.getElementById('msg');
const sendBtn = document.getElementById('send');

async function askJarvis(){
  let q = msgInput.value.trim();
  if(!q) return;
  chat.innerHTML += `<div><b>YOU:</b> ${q}</div>`;
  msgInput.value = '';
  let key = localStorage.getItem('jarvis_key');
  if(!key){ chat.innerHTML += `<div>JARVIS: Pehle AQ wali key SAVE karo</div>`; return; }
  chat.innerHTML += `<div id="thinking"><i>Thinking...</i></div>`;
  try{
    let r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-goog-api-key": key
      },
      body: JSON.stringify({contents:[{parts:[{text:q}]}]})
    });
    let d = await r.json();
    document.getElementById('thinking')?.remove();
    if(d.error){
      chat.innerHTML += `<div><b>ERROR:</b> ${d.error.message}</div>`;
    } else {
      let ans = d.candidates?.[0]?.content?.parts?.[0]?.text || "No Reply";
      chat.innerHTML += `<div><b>JARVIS:</b> ${ans}</div>`;
    }
  } catch(e){
    document.getElementById('thinking')?.remove();
    chat.innerHTML += `<div><b>ERROR:</b> ${e.message}</div>`;
  }
  chat.scrollTop = chat.scrollHeight;
}
sendBtn.onclick = askJarvis;
msgInput.addEventListener('keydown', e=>{ if(e.key==='Enter') askJarvis() });
