const chat = document.getElementById('chat');
const input = document.getElementById('msg');

function add(text, cls) {
  const div = document.createElement('div');
  div.className = 'msg ' + cls;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

document.getElementById('send').onclick = () => {
  const t = input.value.trim();
  if(!t) return;
  add('YOU: ' + t, 'user');
  input.value = '';
  add('J.A.R.V.I.S: Processing...', 'ai');
  setTimeout(() => {
    chat.lastChild.innerText = 'J.A.R.V.I.S: Systems online. How may I assist you?';
  }, 1000);
};

// Enter press pe bhi send ho
input.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') document.getElementById('send').click();
});
