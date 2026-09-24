const chat = document.getElementById('chat');
const input = document.getElementById('msg');

function add(txt, who='jarvis'){
  let d = document.createElement('div');
  d.className = who;
  d.innerHTML = `<b>${who==='user'?'YOU':'J.A.R.V.I.S'}:</b> ${txt}`;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}

document.getElementById('send').onclick = async () => {
  const q = input.value.trim();
  if(!q) return;
  add(q,'user');
  input.value = '';

  let key = localStorage.getItem('jarvis_key');
  if(!key){
    add('Pehle AQ. wali key SAVE karo');
    return;
  }

  add('J.A.R.V.I.S: Processing...','ai');

  try{
    let r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-goog-api-key": key
      },
      body: JSON.stringify({contents:[{parts:[{text: q}]}]})
    });
    let data = await r.json();
    chat.lastChild.remove();
    if(data.error){
      add('ERROR: ' + data.error.message);
    } else {
      add(data.candidates[0].content.parts[0].text);
    }
  }catch(e){
    chat.lastChild.remove();
    add('ERROR: ' + e.message);
  }
};
