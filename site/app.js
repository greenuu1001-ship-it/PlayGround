(function () {
  "use strict";

  const chatLog = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("message");
  const suggestions = document.getElementById("suggestions");
  const voiceToggle = document.getElementById("voice-toggle");
  const voiceChat = document.getElementById("voice-chat");
  const voiceCta = document.getElementById("voice-cta");

  const voiceLabels = {
    toggle: voiceToggle ? voiceToggle.querySelector("span") : null,
    cta: voiceCta ? voiceCta.lastChild : null,
  };

  const replies = [
    {
      match: /день|план|расписан|утр|встреч/i,
      text: "Давайте соберём день мягко. Сначала одно важное дело, потом два коротких, между ними — паузы. Скажите, во сколько вы хотите начать, и я разложу задачи по времени.",
    },
    {
      match: /письм|текст|написа|сообщ|ответ/i,
      text: "Напишу с удовольствием. Мне нужны адресат и нужный тон: тёплый, деловой или совсем короткий. Пришлите пару деталей — я подготовлю черновик от женского имени.",
    },
    {
      match: /задач|список|срочн|дел/i,
      text: "Разложу список на три группы: «сегодня», «на этой неделе» и «можно отпустить». Пришлите задачи — я верну их в спокойном порядке, без чувства вины.",
    },
    {
      match: /устал|тяжел|тревож|стресс|не успева/i,
      text: "Я рядом. Давайте уменьшим громкость дня: выберите одну задачу, которая правда важна, а остальное подождёт до завтра. Я помогу сформулировать первый шаг.",
    },
    {
      match: /привет|здравств|добр|hello|hi/i,
      text: "Здравствуйте. Я Варвара — помощница, которая говорит от женского имени. Чем могу быть полезна: план, текст или разбор задач?",
    },
    {
      match: /спасиб|благодар/i,
      text: "Пожалуйста. Мне приятно быть рядом. Если захотите, вернёмся к делам — я никуда не спешу.",
    },
  ];

  const fallbackReplies = [
    "Я услышала. Давайте начнём с главного: что сейчас важнее всего — план, текст или просто выговориться?",
    "Поняла вас. Могу помочь разложить это по шагам, написать сообщение или просто спокойно обсудить. С чего вам легче начать?",
    "Спасибо, что поделились. Я рядом и готова помочь по-женски внимательно: сначала проясним, потом сделаем.",
  ];

  let fallbackIndex = 0;
  let voiceEnabled = false;
  let lastAssistantText = "";

  function addMessage(role, text) {
    const message = document.createElement("div");
    message.className = "message " + role;
    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = role === "assistant" ? "Варвара" : "Вы";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    message.append(label, paragraph);
    chatLog.append(message);
    chatLog.scrollTop = chatLog.scrollHeight;
    if (role === "assistant") {
      lastAssistantText = text;
    }
    return message;
  }

  function addTyping() {
    const message = document.createElement("div");
    message.className = "message assistant typing";
    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = "Варвара";
    const paragraph = document.createElement("p");
    paragraph.setAttribute("aria-label", "Варвара печатает");
    paragraph.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    message.append(label, paragraph);
    chatLog.append(message);
    chatLog.scrollTop = chatLog.scrollHeight;
    return message;
  }

  function replyFor(text) {
    const found = replies.find(function (item) {
      return item.match.test(text);
    });
    if (found) {
      return found.text;
    }
    const reply = fallbackReplies[fallbackIndex % fallbackReplies.length];
    fallbackIndex += 1;
    return reply;
  }

  function sendMessage(text) {
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) {
      return;
    }
    addMessage("user", clean);
    input.value = "";
    const typing = addTyping();
    const reply = replyFor(clean);
    window.setTimeout(function () {
      typing.remove();
      addMessage("assistant", reply);
      if (voiceEnabled) {
        speak(reply);
      }
    }, 620);
  }

  function speak(text) {
    if (!("speechSynthesis" in window) || !text) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ru-RU";
    utterance.pitch = 1.08;
    utterance.rate = 0.98;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const russian = voices.filter(function (voice) {
      return /^ru(-|_)/i.test(voice.lang);
    });
    const preferred = russian.find(function (voice) {
      return /milena|irina|alena|anna|female|женск/i.test(voice.name);
    });
    if (preferred || russian[0]) {
      utterance.voice = preferred || russian[0];
    }
    window.speechSynthesis.speak(utterance);
  }

  function setVoiceState(enabled) {
    voiceEnabled = enabled;
    [voiceToggle, voiceCta].forEach(function (button) {
      if (!button) {
        return;
      }
      button.setAttribute("aria-pressed", String(enabled));
    });
    if (voiceLabels.toggle) {
      voiceLabels.toggle.textContent = enabled ? "Голос включён" : "Женский голос";
    }
    if (voiceLabels.cta) {
      voiceLabels.cta.textContent = enabled ? " Выключить голос" : " Включить голос";
    }
    if (!enabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function toggleVoice() {
    setVoiceState(!voiceEnabled);
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      sendMessage(input.value);
    });
  }

  if (suggestions) {
    suggestions.addEventListener("click", function (event) {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }
      sendMessage(button.textContent);
    });
  }

  document.querySelectorAll("[data-focus-chat]").forEach(function (button) {
    button.addEventListener("click", function () {
      input.focus();
      document.getElementById("chat").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  if (voiceToggle) {
    voiceToggle.addEventListener("click", toggleVoice);
  }

  if (voiceCta) {
    voiceCta.addEventListener("click", toggleVoice);
  }

  if (voiceChat) {
    voiceChat.addEventListener("click", function () {
      if (!("speechSynthesis" in window)) {
        return;
      }
      if (!voiceEnabled) {
        setVoiceState(true);
      }
      speak(lastAssistantText);
    });
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.addEventListener("voiceschanged", function () {
      window.speechSynthesis.getVoices();
    });
  }

  function showLatestMessage() {
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  showLatestMessage();
  window.requestAnimationFrame(showLatestMessage);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(showLatestMessage).catch(function () {});
  }

  document.body.dataset.appReady = "true";
})();
