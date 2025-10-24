let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;
let existingQRs = new Set();

const scriptUrl = 'https://script.google.com/macros/s/AKfycbyjYTCdWr_34INkN0GoxI5w-HhGc-vS8glz20XZetlao7cMF0HPyNXzf-Umsw5XN8wq/exec';

document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
document.getElementById('saveToCSV').addEventListener('click', saveToCSV);

// CARGAR QRs EXISTENTES
async function loadExistingQRs() {
  try {
    const response = await fetch(scriptUrl);
    const text = await response.text();
    if (text && text !== 'ERROR') {
      const qrs = text.split('|').map(q => q.trim()).filter(Boolean);
      existingQRs = new Set(qrs);
      setStatus(`Listo: ${qrs.length} códigos cargados.`);
    }
  } catch (err) {
    console.warn('Error cargando QRs:', err);
  }
}

window.addEventListener('load', loadExistingQRs);

function setStatus(msg, error = false) {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.style.color = error ? 'red' : '#4CAF50';
}

function getUser() {
  return document.getElementById('userSelect').value;
}

function startScanning() {
  if (!getUser()) {
    setStatus('Selecciona un usuario.', true);
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Cámara no soportada.', true);
    return;
  }

  scanning = true;
  document.getElementById('startScan').style.display = 'none';
  document.getElementById('stopScan').style.display = 'block';
  document.getElementById('result').style.display = 'none';
  setStatus('Escaneando...');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(s => {
      stream = s;
      video.srcObject = stream;
      video.play();
      requestAnimationFrame(scanQR);
    })
    .catch(() => setStatus('Error de cámara.', true));
}

function stopScanning() {
  scanning = false;
  document.getElementById('startScan').style.display = 'block';
  document.getElementById('stopScan').style.display = 'none';
  setStatus('');
  if (stream) stream.getTracks().forEach(t => t.stop());
}

function scanQR() {
  if (!scanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(scanQR);
    return;
  }

  canvas.height = video.videoHeight;
  canvas.width = video.videoWidth;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);

  if (code) {
    qrData = code.data.trim();
    document.getElementById('qrData').textContent = qrData;
    document.getElementById('result').style.display = 'block';
    stopScanning();

    // VERIFICAR Y ENVIAR AUTOMÁTICAMENTE
    autoSaveQR();
  } else {
    requestAnimationFrame(scanQR);
  }
}

async function autoSaveQR() {
  const user = getUser();
  if (!user || !qrData) return;

  // VALIDACIÓN LOCAL
  if (existingQRs.has(qrData)) {
    setStatus('DUPLICADO: Este QR ya fue registrado.', true);
    return;
  }

  const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(user)}`;

  // ENVIAR AL SERVIDOR
  fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  })
  .then(() => {
    existingQRs.add(qrData);
    setStatus(`ÉXITO: ${user} registró: ${qrData}`, false);
  })
  .catch(() => {
    setStatus('Error de red. Intenta de nuevo.', true);
  });
}

function saveToCSV() {
  if (!qrData) {
    setStatus('No hay QR para guardar.', true);
    return;
  }

  const user = getUser() || 'Anónimo';
  const timestamp = new Date().toLocaleString('es-ES');
  let data = localStorage.getItem('qrList') || '';
  data += `"${timestamp}","${user}","${qrData}"\n`;
  localStorage.setItem('qrList', data);

  const csv = 'data:text/csv;charset=utf-8,Fecha,Usuario,QR\n' + data;
  const a = document.createElement('a');
  a.href = encodeURI(csv);
  a.download = 'qr_lecturas.csv';
  a.click();
  setStatus('CSV descargado');
}
