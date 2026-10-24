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

// ===== 3. CORE BRAIN (GEMINI CALL) =====
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
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: contents })
        }
      );
      const data = await res.json();
      
      if (data.candidates && data.candidates[0]) {
        return data.candidates[0].content.parts[0].text;
      } else if (data.error) {
        throw new Error(data.error.message);
      }
    } catch (e) {
      console.log(`${MODEL} failed: ${e.message}`);
      continue;
    }
  }
  throw new Error("All models failed");
}

// ===== 4. MAIN EXECUTE FUNCTION =====
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

// ===== 5. VOICE & VISION =====
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
