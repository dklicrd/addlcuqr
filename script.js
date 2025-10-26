let codeReader = new ZXing.BrowserMultiFormatReader();
let scanning = false;
let qrData = '';
let stream = null;
let existingQRs = new Set();

const scriptUrl = 'https://script.google.com/macros/s/AKfycbyjYTCdWr_34INkN0GoxI5w-HhGc-vS8glz20XZetlao7cMF0HPyNXzf-Umsw5XN8wq/exec';
const STORAGE_KEY = 'scannedQRs';

document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
document.getElementById('saveToCSV').addEventListener('click', saveToCSV);

window.addEventListener('load', () => {
  loadLocalQRs();
  syncWithServer();
});

function setStatus(message, isError = false) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.style.color = isError ? 'red' : '#4CAF50';
}

function getUser() { return document.getElementById('userSelect').value.trim(); }
function getProject() { return document.getElementById('projectSelect').value.trim(); }

function loadLocalQRs() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) existingQRs = new Set(JSON.parse(data));
}

async function syncWithServer() {
  try {
    const res = await fetch(scriptUrl + '?sync=1'); // ← Añade parámetro
    const text = await res.text();
    if (text) text.split('|').forEach(q => existingQRs.add(q.trim()));
    saveToLocalStorage();
  } catch (e) { console.warn(e); }
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(existingQRs)));
}

function startScanning() {
  const user = getUser(), project = getProject();
  if (!user || !project) { setStatus('Selecciona usuario y proyecto.', true); return; }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(s => {
      stream = s;
      const video = document.getElementById('video');
      video.srcObject = stream;
      video.play();
      scanning = true;
      document.getElementById('startScan').style.display = 'none';
      document.getElementById('stopScan').style.display = 'block';
      setStatus('Escaneando...');

      codeReader.decodeFromVideoDevice(undefined, 'video', (result) => {
        if (result && scanning) {
          qrData = result.text.trim();
          document.getElementById('qrData').textContent = qrData;
          document.getElementById('result').style.display = 'block';
          stopScanning();
          autoSaveQR();
        }
      });
    })
    .catch(e => setStatus('Cámara: ' + e.message, true));
}

function stopScanning() {
  scanning = false;
  codeReader.reset();
  document.getElementById('startScan').style.display = 'block';
  document.getElementById('stopScan').style.display = 'none';
  setStatus('');
  if (stream) stream.getTracks().forEach(t => t.stop());
}

async function autoSaveQR() {
  const user = getUser(), project = getProject();
  if (!qrData || !user || !project) return;

  if (existingQRs.has(qrData)) {
    setStatus('DUPLICADO.', true);
    return;
  }

  const url = `${scriptUrl}?project=${encodeURIComponent(project)}&user=${encodeURIComponent(user)}&qrData=${encodeURIComponent(qrData)}`;

  try {
    const res = await fetch(url);
    const text = await res.text();

    if (text === 'SUCCESS') {
      existingQRs.add(qrData);
      saveToLocalStorage();
      setStatus(`ÉXITO: ${project} → ${user}`);
    } else {
      setStatus('Error: ' + text, true);
    }
  } catch (err) {
    setStatus('Error: ' + err.message, true);
  }
}

function saveToCSV() {
  if (!qrData) return;
  const user = getUser() || 'Anónimo';
  const project = getProject() || 'Sin proyecto';
  const timestamp = new Date().toLocaleString('es-ES');
  let data = localStorage.getItem('qrList') || '';
  data += `"${timestamp}","${project}","${user}","${qrData}"\n`;
  localStorage.setItem('qrList', data);

  const link = document.createElement('a');
  link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('Fecha_Hora,Proyecto,Usuario,Datos\n' + data);
  link.download = 'lecturas.csv';
  link.click();
  setStatus('CSV descargado');
}
