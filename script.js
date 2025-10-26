// === ZXing para QR y códigos de barra (1D/2D) ===
let codeReader = new ZXing.BrowserMultiFormatReader();
let scanning = false;
let qrData = '';
let stream = null;
let existingQRs = new Set();

// === CONFIGURACIÓN ===
const scriptUrl = 'https://script.google.com/macros/s/AKfycbyjYTCdWr_34INkN0GoxI5w-HhGc-vS8glz20XZetlao7cMF0HPyNXzf-Umsw5XN8wq/exec';
const STORAGE_KEY = 'scannedQRs';

// === EVENTOS ===
document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
document.getElementById('saveToCSV').addEventListener('click', saveToCSV);

// === CARGA INICIAL: localStorage + sincronización con Sheets ===
window.addEventListener('load', () => {
  loadLocalQRs();
  syncWithServer();
});

// === FUNCIONES AUXILIARES ===
function setStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = isError ? 'red' : '#4CAF50';
}

function getUser() {
  return document.getElementById('userSelect').value.trim();
}

function getProject() {
  return document.getElementById('projectSelect').value.trim();
}

// Cargar códigos guardados en localStorage
function loadLocalQRs() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      existingQRs = new Set(JSON.parse(data));
    } catch (e) {
      console.error('Error en localStorage:', e);
    }
  }
}

// Guardar en localStorage
function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(existingQRs)));
}

// Sincronizar con Google Sheets (solo GET)
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
      setStatus(`Sincronizado: +${added} códigos nuevos. Total: ${existingQRs.size}`);
    }
  } catch (err) {
    console.warn('Error sincronizando con Sheets:', err);
    setStatus('Offline: usando memoria local.');
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
      setStatus('Escaneando... Apunta al código QR o de barras.');

      // ZXing escanea continuamente
      codeReader.decodeFromVideoDevice(undefined, 'video', (result, err) => {
        if (result && scanning) {
          qrData = result.text.trim();
          document.getElementById('qrData').textContent = qrData;
          document.getElementById('result').style.display = 'block';
          stopScanning();
          autoSaveQR();
        }
        if (err && !(err instanceof ZXing.NotFoundException)) {
          console.error('Error ZXing:', err);
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

// === ENVÍO AUTOMÁTICO CON no-cors + postData ===
async function autoSaveQR() {
  const user = getUser();
  const project = getProject();
  if (!qrData || !user || !project) return;

  // Validación local (duplicados)
  if (existingQRs.has(qrData)) {
    setStatus('DUPLICADO: Este código ya fue registrado.', true);
    return;
  }

  const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(user)}&project=${encodeURIComponent(project)}`;

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',  // NECESARIO para que Apps Script lea e.postData
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    });

    // ASUMIMOS ÉXITO (no-cors no permite leer respuesta)
    existingQRs.add(qrData);
    saveToLocalStorage();
    setStatus(`ÉXITO: ${user} registró en "${project}": ${qrData}`);

  } catch (err) {
    setStatus('Error de red. Intenta de nuevo.', true);
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

  const csv = 'data:text/csv;charset=utf-8,Fecha_Hora,Proyecto,Usuario,Datos\n' + data;
  const link = document.createElement('a');
  link.href = encodeURI(csv);
  link.download = 'lecturas_qr.csv';
  link.click();
  setStatus('CSV descargado (respaldo local)');
}
