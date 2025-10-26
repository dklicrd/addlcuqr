let codeReader = new ZXing.BrowserMultiFormatReader();
let scanning = false;
let qrData = '';
let stream = null;
let existingQRs = new Set();

const scriptUrl = 'https://script.google.com/macros/s/AKfycbyjYTCdWr_34INkN0GoxI5w-HhGc-vS8glz20XZetlao7cMF0HPyNXzf-Umsw5XN8wq/exec';
const STORAGE_KEY = 'scannedQRs';

// === EVENTOS ===
document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
document.getElementById('saveToCSV').addEventListener('click', saveToCSV);

// === CARGA INICIAL ===
window.addEventListener('load', () => {
  loadLocalQRs();
  syncWithServer();
});

// === ESTADO ===
function setStatus(message, isError = false) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'red' : '#4CAF50';
}

// === SELECTORES ===
function getUser() {
  return document.getElementById('userSelect').value.trim();
}

function getProject() {
  return document.getElementById('projectSelect').value.trim();
}

// === LOCAL STORAGE ===
function loadLocalQRs() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      existingQRs = new Set(JSON.parse(data));
    } catch (e) {
      console.error('Error cargando localStorage:', e);
    }
  }
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(existingQRs)));
}

// === SINCRONIZACIÓN CON SERVIDOR ===
async function syncWithServer() {
  try {
    const response = await fetch(scriptUrl);
    const text = await response.text();
    if (text && text !== 'ERROR') {
      const serverQRs = text.split('|').map(q => q.trim()).filter(Boolean);
      let added = 0;
      serverQRs.forEach(qr => {
        if (!existingQRs.has(qr)) {
          existingQRs.add(qr);
          added++;
        }
      });
      if (added > 0) saveToLocalStorage();
      setStatus(`Sincronizado: +${added} códigos. Total: ${existingQRs.size}`);
    }
  } catch (err) {
    console.warn('Error sincronizando:', err);
    setStatus('Modo offline: usando memoria local.');
  }
}

// === INICIAR ESCANEO ===
function startScanning() {
  const user = getUser();
  const project = getProject();
  if (!user || !project) {
    setStatus('Selecciona usuario y proyecto.', true);
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(mediaStream => {
      stream = mediaStream;
      const video = document.getElementById('video');
      video.srcObject = stream;
      video.play();

      scanning = true;
      document.getElementById('startScan').style.display = 'none';
      document.getElementById('stopScan').style.display = 'block';
      document.getElementById('result').style.display = 'none';
      setStatus('Escaneando...');

      codeReader.decodeFromVideoDevice(undefined, 'video', (result, err) => {
        if (result && scanning) {
          qrData = result.text.trim();
          document.getElementById('qrData').textContent = qrData;
          document.getElementById('result').style.display = 'block';
          stopScanning();
          autoSaveQR();
        }
        if (err && !(err instanceof ZXing.NotFoundException)) {
          console.error('ZXing error:', err);
        }
      });
    })
    .catch(err => {
      setStatus('Error de cámara: ' + err.message, true);
    });
}

// === DETENER ESCANEO ===
function stopScanning() {
  scanning = false;
  codeReader.reset();
  document.getElementById('startScan').style.display = 'block';
  document.getElementById('stopScan').style.display = 'none';
  setStatus('');
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

// === ENVÍO AUTOMÁTICO (POST + no-cors) ===
async function autoSaveQR() {
  const user = getUser();
  const project = getProject();
  if (!qrData || !user || !project) {
    setStatus('Faltan datos.', true);
    return;
  }

  if (existingQRs.has(qrData)) {
    setStatus('DUPLICADO: Este código ya fue registrado.', true);
    return;
  }

  // ORDEN CLAVE: project PRIMERO
  const payload = `project=${encodeURIComponent(project)}&user=${encodeURIComponent(user)}&qrData=${encodeURIComponent(qrData)}`;

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    });

    existingQRs.add(qrData);
    saveToLocalStorage();
    setStatus(`ÉXITO: ${user} registró en "${project}": ${qrData}`);

  } catch (err) {
    setStatus('Error de red: ' + err.message, true);
  }
}

// === DESCARGAR CSV LOCAL ===
function saveToCSV() {
  if (!qrData) {
    setStatus('No hay datos para guardar.', true);
    return;
  }

  const user = getUser() || 'Anónimo';
  const project = getProject() || 'Sin proyecto';
  const timestamp = new Date().toLocaleString('es-ES');
  let data = localStorage.getItem('qrList') || '';
  data += `"${timestamp}","${project}","${user}","${qrData.replace(/"/g, '""')}"\n`;
  localStorage.setItem('qrList', data);

  const csv = 'data:text/csv;charset=utf-8,Fecha_Hora,Proyecto,Usuario,Código_QR\n' + data;
  const link = document.createElement('a');
  link.href = encodeURI(csv);
  link.download = 'lecturas_qr.csv';
  link.click();
  setStatus('CSV descargado');
}
