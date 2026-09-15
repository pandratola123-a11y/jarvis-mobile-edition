const chat=document.getElementById('chat');
const input=document.getElementById('msg');

document.getElementById('send').onclick=()=>{
 const t=input.value.trim();
 if(!t)return;
 add('YOU: '+t,'user');
 input.value='';
 add('J.A.R.V.I.S: Processing...','ai');
 setTimeout(()=>{
  chat.lastChild.innerText='J.A.R.V.I.S: Systems online. How may i assi';
 },1000);
};
