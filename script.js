console.log("HFF Script started.");

// ===== DOM =====
const micBtn = document.getElementById('micBtn');
const status = document.getElementById('status');
const transcriptDiv = document.getElementById('transcript');

const MY_NUMBER = "5521992851164";

const manualValueInput = document.getElementById('manualValue');
const manualDescriptionInput = document.getElementById('manualDescription');
const btnManualEntry = document.getElementById('btnManualEntry');
const btnManualExit = document.getElementById('btnManualExit');
const btnSendReport = document.getElementById('btnSendReport');

// desbloqueio
const lockOverlay = document.getElementById('lockOverlay');
const pinInput = document.getElementById('pinInput');
const unlockBtn = document.getElementById('unlockBtn');

// settings (novo)
const lockBtn = document.getElementById('lockBtn');
const lockSettingsOverlay = document.getElementById('lockSettingsOverlay');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const lockEnabledToggle = document.getElementById('lockEnabledToggle');
const pinBox = document.getElementById('pinBox');
const lockPinSet = document.getElementById('lockPinSet');
const savePinBtn = document.getElementById('savePinBtn');
const lockNowBtn = document.getElementById('lockNowBtn');
const disableLockBtn = document.getElementById('disableLockBtn');

// ===== AUDIO (beep) =====
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(freq, duration) {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// ===== SENHA OPCIONAL (modo C: voz + digitar) =====
const LOCK_ENABLED_KEY = 'hff_lock_enabled';
const LOCK_PIN_KEY = 'hff_lock_pin';
const UNLOCKED_KEY = 'hff_unlocked';

function isLockEnabled() { return localStorage.getItem(LOCK_ENABLED_KEY) === 'true'; }
function getPin() { return localStorage.getItem(LOCK_PIN_KEY) || ''; }
function isUnlocked() { return localStorage.getItem(UNLOCKED_KEY) === 'true'; }
function isLocked() { return isLockEnabled() && !isUnlocked(); }

function showLock() { lockOverlay.setAttribute('aria-hidden', 'false'); }
function hideLock() { lockOverlay.setAttribute('aria-hidden', 'true'); }

function showSettings() { lockSettingsOverlay.setAttribute('aria-hidden', 'false'); }
function hideSettings() { lockSettingsOverlay.setAttribute('aria-hidden', 'true'); }

function lockNow() {
  localStorage.setItem(UNLOCKED_KEY, 'false');
  showLock();

  isContinuousMode = false;
  try { if (recognition) recognition.stop(); } catch (e) {}

  micBtn.classList.remove('listening');
  status.innerText = "Toque para falar";
}

function unlockNow() {
  localStorage.setItem(UNLOCKED_KEY, 'true');
  hideLock();
  pinInput.value = '';

  if (audioCtx.state === 'suspended') audioCtx.resume();
  playBeep(800, 0.2);
}

function disableLock() {
  localStorage.setItem(LOCK_ENABLED_KEY, 'false');
  localStorage.removeItem(LOCK_PIN_KEY);
  localStorage.setItem(UNLOCKED_KEY, 'true');
  hideLock();
  hideSettings();
  playBeep(800, 0.2);
}

function saveLockSettings() {
  const enabled = !!lockEnabledToggle.checked;

  if (!enabled) {
    disableLock();
    return;
  }

  const pin = (lockPinSet.value || '').trim();
  if (!/^\d{4}$/.test(pin)) {
    alert("PIN inválido. Precisa ter exatamente 4 dígitos.");
    playBeep(100, 0.3);
    return;
  }

  localStorage.setItem(LOCK_ENABLED_KEY, 'true');
  localStorage.setItem(LOCK_PIN_KEY, pin);
  localStorage.setItem(UNLOCKED_KEY, 'true');

  hideSettings();
  playBeep(800, 0.2);
}

function syncSettingsUI() {
  const enabled = isLockEnabled();
  lockEnabledToggle.checked = enabled;
  lockPinSet.value = getPin();
  pinBox.style.display = enabled ? 'block' : 'none';
}

function tryUnlockFromVoice(cmd) {
  const pin = getPin();
  if (!pin) return false;

  const m = cmd.match(/\b(\d{4})\b/);
  if (m && m[1] === pin) {
    unlockNow();
    return true;
  }
  return false;
}

// ===== TEMA =====
function setDarkMode() {
  document.body.classList.add('dark-mode');
  localStorage.setItem('hff_theme', 'dark');
  playBeep(800, 0.2);
}
function setLightMode() {
  document.body.classList.remove('dark-mode');
  localStorage.setItem('hff_theme', 'light');
  playBeep(800, 0.2);
}
function loadTheme() {
  const t = localStorage.getItem('hff_theme');
  if (t === 'dark') document.body.classList.add('dark-mode');
  if (t === 'light') document.body.classList.remove('dark-mode');
}

// ===== CONFIRMAÇÃO POR VOZ (reset) =====
let pendingVoiceAction = null;
let pendingVoiceTimer = null;

function requestVoiceConfirm(fn) {
  pendingVoiceAction = fn;
  if (pendingVoiceTimer) clearTimeout(pendingVoiceTimer);
  pendingVoiceTimer = setTimeout(() => { pendingVoiceAction = null; }, 10000);
  alert('Confirme dizendo: "confirmar" (até 10s) ou diga "cancelar"');
  playBeep(600, 0.2);
}

// ===== DATA =====
function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

// ===== DADOS =====
let appData = JSON.parse(localStorage.getItem('hff_app_data')) || {
  currentMonthKey: getCurrentMonthKey(),
  monthlyRecords: {},
  monthlyBackups: {}
};

if (!appData.monthlyRecords) appData.monthlyRecords = {};
if (!appData.monthlyBackups) appData.monthlyBackups = {};

appData.currentMonthKey = getCurrentMonthKey();
if (!appData.monthlyRecords[appData.currentMonthKey]) {
  appData.monthlyRecords[appData.currentMonthKey] = { in: 0, out: 0, balance: 0 };
}

function saveData() {
  localStorage.setItem('hff_app_data', JSON.stringify(appData));
}

function backupMonth(monthKey) {
  const m = appData.monthlyRecords[monthKey];
  if (!m) return;

  const inV = Number(m.in || 0);
  const outV = Number(m.out || 0);
  const bal = inV - outV;

  if (inV === 0 && outV === 0) return;

  if (!appData.monthlyBackups[monthKey]) appData.monthlyBackups[monthKey] = [];
  appData.monthlyBackups[monthKey].push({ ts: Date.now(), in: inV, out: outV, balance: bal });

  saveData();
}

// ===== CHART =====
const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Entradas', 'Saídas'],
    datasets: [{
      data: [0, 0],
      backgroundColor: ['#10b981', '#ef4444'],
      borderRadius: 8
    }]
  },
  options: {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } }
  }
});

function updateUI() {
  const currentMonthData = appData.monthlyRecords[appData.currentMonthKey];
  const currentBalance = Number(currentMonthData.in || 0) - Number(currentMonthData.out || 0);

  document.getElementById('totalIn').innerText =
    `R$ ${(Number(currentMonthData.in || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  document.getElementById('totalOut').innerText =
    `R$ ${(Number(currentMonthData.out || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const balanceElement = document.getElementById('currentBalance');
  balanceElement.innerText =
    `R$ ${currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  balanceElement.classList.remove('up', 'down', 'neutral');

  const negativeAlertElement = document.getElementById('negativeAlert');
  negativeAlertElement.style.display = 'none';

  if (currentBalance > 0) {
    balanceElement.classList.add('up');
  } else if (currentBalance < 0) {
    balanceElement.classList.add('down');
    negativeAlertElement.style.display = 'block';
  } else {
    balanceElement.classList.add('neutral');
  }

  myChart.data.datasets[0].data = [Number(currentMonthData.in || 0), Number(currentMonthData.out || 0)];
  myChart.update();

  saveData();
}

// ===== AÇÕES =====
function sendReport() {
  if (isLocked()) return;

  const m = appData.monthlyRecords[appData.currentMonthKey];
  const inV = Number(m.in || 0);
  const outV = Number(m.out || 0);
  const bal = inV - outV;

  const text =
    `*Relatório HFF (Mês ${appData.currentMonthKey})*%0A%0A` +
    `✅ *Entradas:* R$ ${inV.toFixed(2)}%0A` +
    `❌ *Saídas:* R$ ${outV.toFixed(2)}%0A` +
    `💰 *Saldo Atual:* R$ ${bal.toFixed(2)}`;

  window.open(`https://wa.me/${MY_NUMBER}?text=${text}`, '_blank');
  playBeep(800, 0.3);
}

function resetCurrentMonthData(skipConfirm = false) {
  if (isLocked()) return;

  if (!skipConfirm) {
    const ok = confirm(`Deseja zerar os dados financeiros do mês ${appData.currentMonthKey}? Esta ação não pode ser desfeita.`);
    if (!ok) return;
  }

  backupMonth(appData.currentMonthKey);

  appData.monthlyRecords[appData.currentMonthKey] = { in: 0, out: 0, balance: 0 };
  updateUI();
  playBeep(400, 0.2);
  setTimeout(() => playBeep(400, 0.2), 250);
  setTimeout(() => playBeep(600, 0.4), 500);
}

function resetAllData(skipConfirm = false) {
  if (isLocked()) return;

  if (!skipConfirm) {
    const ok = confirm("Deseja zerar TODOS os dados financeiros (incluindo histórico e backups)? Esta ação não pode ser desfeita.");
    if (!ok) return;
  }

  appData = { currentMonthKey: getCurrentMonthKey(), monthlyRecords: {}, monthlyBackups: {} };
  appData.monthlyRecords[appData.currentMonthKey] = { in: 0, out: 0, balance: 0 };
  updateUI();
  playBeep(400, 0.2);
  setTimeout(() => playBeep(400, 0.2), 250);
  setTimeout(() => playBeep(600, 0.4), 500);
}

function showFinancialHistory() {
  if (isLocked()) return;

  let historyText = "Histórico Financeiro (por mês):\n\n";
  const months = Object.keys(appData.monthlyRecords).sort();

  let totalAccumulatedBalance = 0;
  let bestMonth = { key: '', balance: -Infinity };
  let worstMonth = { key: '', balance: Infinity };
  const yearlyBalances = {};

  if (months.length === 0) {
    historyText += "Nenhum registro.\n";
  } else {
    months.forEach(monthKey => {
      const monthData = appData.monthlyRecords[monthKey] || { in: 0, out: 0 };
      const inV = Number(monthData.in || 0);
      const outV = Number(monthData.out || 0);
      const bal = inV - outV;

      historyText += `Mês ${monthKey}: Entradas R$ ${inV.toFixed(2)}, Saídas R$ ${outV.toFixed(2)}, Saldo R$ ${bal.toFixed(2)}\n`;

      totalAccumulatedBalance += bal;
      if (bal > bestMonth.balance) bestMonth = { key: monthKey, balance: bal };
      if (bal < worstMonth.balance) worstMonth = { key: monthKey, balance: bal };

      const year = monthKey.substring(0, 4);
      yearlyBalances[year] = (yearlyBalances[year] || 0) + bal;

      const backups = appData.monthlyBackups[monthKey] || [];
      if (backups.length > 0) {
        historyText += `  Backups (${backups.length}):\n`;
        backups.forEach((bk, idx) => {
          const dt = new Date(bk.ts).toLocaleString('pt-BR');
          historyText += `   - Backup ${idx + 1} (${dt}): Entradas R$ ${Number(bk.in).toFixed(2)}, Saídas R$ ${Number(bk.out).toFixed(2)}, Saldo R$ ${Number(bk.balance).toFixed(2)}\n`;
        });
      }
    });

    historyText += "\n--- Resumo Geral ---\n";
    historyText += `Saldo Acumulado Total: R$ ${totalAccumulatedBalance.toFixed(2)}\n`;
    if (bestMonth.key) historyText += `Melhor Mês: ${bestMonth.key} (Saldo R$ ${bestMonth.balance.toFixed(2)})\n`;
    if (worstMonth.key) historyText += `Pior Mês: ${worstMonth.key} (Saldo R$ ${worstMonth.balance.toFixed(2)})\n`;

    const years = Object.keys(yearlyBalances).sort();
    if (years.length > 0) {
      historyText += "\n--- Saldo Anual ---\n";
      years.forEach(year => {
        historyText += `Ano ${year}: Saldo R$ ${yearlyBalances[year].toFixed(2)}\n`;
      });
    }
  }

  alert(historyText);
  playBeep(800, 0.5);
}

function handleManualTransaction(type) {
  if (isLocked()) return;

  const raw = (manualValueInput.value || '').toString().replace(',', '.');
  let value = parseFloat(raw);
  const description = (manualDescriptionInput.value || '').trim();

  if (isNaN(value) || value <= 0) {
    alert("Por favor, insira um valor numérico válido e positivo.");
    playBeep(100, 0.5);
    return;
  }

  const m = appData.monthlyRecords[appData.currentMonthKey];

  if (type === 'in') {
    m.in = Number(m.in || 0) + value;
    playBeep(800, 0.2);
  } else {
    m.out = Number(m.out || 0) + value;
    playBeep(200, 0.4);
  }

  m.balance = Number(m.in || 0) - Number(m.out || 0);
  updateUI();

  manualValueInput.value = '';
  manualDescriptionInput.value = '';
}

// ===== VOZ =====
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isContinuousMode = false;

function stopMicNow() {
  isContinuousMode = false;
  try { if (recognition) recognition.stop(); } catch (e) {}
  micBtn.classList.remove('listening');
  status.innerText = "Toque para falar";
  playBeep(400, 0.2);
}

function processCommand(cmdRaw) {
  const cmd = (cmdRaw || '').toLowerCase().trim();
  console.log("Comando recebido:", cmd);

  // confirmação por voz
  if (pendingVoiceAction) {
    if (cmd.includes("confirmar") || cmd.includes("confirma")) {
      const fn = pendingVoiceAction;
      pendingVoiceAction = null;
      fn();
      return;
    }
    if (cmd.includes("cancelar")) {
      pendingVoiceAction = null;
      playBeep(200, 0.2);
      return;
    }
  }

  // ✅ BUGFIX: desligar mic por VOZ (funciona mesmo em modo contínuo)
  if (
    cmd.includes("desligar mic") ||
    cmd.includes("desligar microfone") ||
    cmd.includes("parar microfone") ||
    cmd.includes("parar de ouvir") ||
    cmd.includes("desativar microfone")
  ) {
    stopMicNow();
    return;
  }

  // bloqueado: só tenta desbloquear
  if (isLocked()) {
    tryUnlockFromVoice(cmd);
    return;
  }

  // tema
  if (cmd.includes("modo noturno") || cmd.includes("noturno") || cmd.includes("noite") || cmd.includes("escuro")) {
    setDarkMode();
    return;
  }

  if (cmd.includes("modo claro") || cmd.includes("claro") || cmd.includes("dia")) {
    setLightMode();
    return;
  }

  // saldo
  if (cmd.includes("saldo")) {
    const m = appData.monthlyRecords[appData.currentMonthKey];
    const bal = Number(m.in || 0) - Number(m.out || 0);
    alert(`Seu saldo atual do mês é de R$ ${bal.toFixed(2)}.`);
    playBeep(800, 0.5);
    return;
  }

  // histórico
  if (cmd.includes("historico") || cmd.includes("histórico")) {
    showFinancialHistory();
    return;
  }

  // reset mês/planilha
  if (cmd.includes("resetar") && (cmd.includes("planilha") || cmd.includes("mês") || cmd.includes("mes"))) {
    requestVoiceConfirm(() => resetCurrentMonthData(true));
    return;
  }

  // reset tudo
  if (cmd.includes("resetar tudo") || cmd.includes("zerar tudo") || cmd.includes("limpar tudo")) {
    requestVoiceConfirm(() => resetAllData(true));
    return;
  }

  // enviar relatório (por voz orienta)
  if (cmd.includes("enviar") && (cmd.includes("relatorio") || cmd.includes("relatório"))) {
    alert("Para enviar o relatório, clique no botão 'Enviar Relatório do Mês p/ WhatsApp' na tela.");
    playBeep(600, 0.3);
    return;
  }

  // relatório
  if (cmd.includes("relatorio") || cmd.includes("relatório")) {
    const m = appData.monthlyRecords[appData.currentMonthKey];
    const inV = Number(m.in || 0);
    const outV = Number(m.out || 0);
    const bal = inV - outV;

    alert(
      `Relatório HFF (Mês ${appData.currentMonthKey}):\n` +
      `Entradas: R$ ${inV.toFixed(2)}\n` +
      `Saídas: R$ ${outV.toFixed(2)}\n` +
      `Saldo: R$ ${bal.toFixed(2)}`
    );
    playBeep(800, 0.5);
    return;
  }

  // financeiro por voz
  const valueMatch = cmd.match(/(\d+[,.]\d{2}|\d+)/);
  let value = 0;
  if (valueMatch) value = parseFloat(valueMatch[0].replace(',', '.'));

  if (!isNaN(value) && value > 0) {
    const isEntry = ["recebi", "ganhei", "pix", "entrada", "caiu", "vendi", "salário", "salario"].some(v => cmd.includes(v));
    const isExit = ["gastei", "paguei", "saída", "saida", "custou", "perdi", "débito", "debito", "compras", "compra"].some(v => cmd.includes(v));

    const m = appData.monthlyRecords[appData.currentMonthKey];

    if (isEntry) {
      m.in = Number(m.in || 0) + value;
      playBeep(800, 0.2);
    } else if (isExit) {
      m.out = Number(m.out || 0) + value;
      playBeep(200, 0.4);
    } else {
      playBeep(200, 0.6);
      return;
    }

    m.balance = Number(m.in || 0) - Number(m.out || 0);
    updateUI();
    return;
  }

  playBeep(200, 0.6);
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const currentTranscript = event.results[event.results.length - 1][0].transcript;
    transcriptDiv.innerText = `"${currentTranscript}"`;
    processCommand(currentTranscript);
  };

  recognition.onend = () => {
    if (isContinuousMode) {
      setTimeout(() => { try { recognition.start(); } catch (e) {} }, 100);
    } else {
      micBtn.classList.remove('listening');
      status.innerText = "Toque para falar";
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech Recognition Error:', event.error);
    status.innerText = `Erro: ${event.error}`;
    playBeep(100, 0.5);
    micBtn.classList.remove('listening');
    isContinuousMode = false;
    try { recognition.stop(); } catch (e) {}
  };
} else {
  alert("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Safari.");
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  updateUI();

  // overlays
  if (isLocked()) showLock(); else hideLock();
  hideSettings();

  // settings UI inicial
  syncSettingsUI();

  lockEnabledToggle.addEventListener('change', () => {
    pinBox.style.display = lockEnabledToggle.checked ? 'block' : 'none';
    if (lockEnabledToggle.checked) setTimeout(() => lockPinSet.focus(), 150);
  });

  savePinBtn.addEventListener('click', saveLockSettings);
  disableLockBtn.addEventListener('click', disableLock);

  lockNowBtn.addEventListener('click', () => {
    if (!isLockEnabled()) {
      alert("Ative o bloqueio e salve um PIN primeiro.");
      playBeep(100, 0.3);
      return;
    }
    hideSettings();
    lockNow();
  });

  settingsCloseBtn.addEventListener('click', () => hideSettings());

  // botão 🔒 abre o painel bonito
  lockBtn.addEventListener('click', () => {
    if (isLocked()) return;
    syncSettingsUI();
    showSettings();
  });

  // desbloqueio digitando
  unlockBtn.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const pin = (pinInput.value || '').trim();
    if (pin === getPin() && /^\d{4}$/.test(pin)) {
      unlockNow();
    } else {
      alert('PIN incorreto.');
      playBeep(100, 0.3);
    }
  });

  // microfone (botão)
  micBtn.addEventListener('click', () => {
    if (isLocked()) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!recognition) return;

    if (!isContinuousMode) {
      isContinuousMode = true;
      transcriptDiv.innerText = "";
      try { recognition.start(); } catch (e) {}
      micBtn.classList.add('listening');
      status.innerText = "Ouvindo continuamente...";
    } else {
      stopMicNow();
    }
  });

  // botões
  btnSendReport.addEventListener('click', sendReport);
  btnManualEntry.addEventListener('click', () => handleManualTransaction('in'));
  btnManualExit.addEventListener('click', () => handleManualTransaction('out'));

  // shake
  let last_x = 0, last_y = 0, last_z = 0, last_update = 0;
  const SHAKE_THRESHOLD = 1500;
  let shakeTimeout = null;

  if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', function (event) {
      if (isLocked()) return;

      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const now = Date.now();
      if ((now - last_update) <= 100) return;

      const diffTime = now - last_update;
      last_update = now;

      const x = acceleration.x || 0;
      const y = acceleration.y || 0;
      const z = acceleration.z || 0;

      const speed = Math.abs(x + y + z - last_x - last_y - last_z) / diffTime * 10000;

      if (speed > SHAKE_THRESHOLD) {
        if (!shakeTimeout) {
          shakeTimeout = setTimeout(() => {
            showFinancialHistory();
            shakeTimeout = null;
          }, 500);
        }
      }

      last_x = x; last_y = y; last_z = z;
    });
  }
});