let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;
let existingQRs = new Set();  // Conjunto para validación local

const scriptUrl = 'https://script.google.com/macros/s/AKfycbyjYTCdWr_34INkN0GoxI5w-HhGc-vS8glz20XZetlao7cMF0HPyNXzf-Umsw5XN8wq/exec';

document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
document.getElementById('sendToGoogle').addEventListener('click', sendToGoogleForm);
document.getElementById('saveToCSV').addEventListener('click', saveToCSV);

function setStatus(message, isError = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = isError ? 'red' : '#4CAF50';
}

function getUser() {
  return document.getElementById('userSelect').value;
}

// Cargar QRs existentes al inicio (validación local)
async function loadExistingQRs() {
  try {
    const response = await fetch(scriptUrl, { method: 'GET' });
    const qrListText = await response.text();
    if (qrListText) {
      const qrList = qrListText.split(',').map(qr => qr.trim());
      qrList.forEach(qr => existingQRs.add(qr));
      setStatus(`Cargados ${qrList.length} códigos existentes.`);
    }
  } catch (err) {
    console.warn('Error cargando QRs:', err);
    setStatus('Modo offline: validación local limitada.');
  }
}

// Al cargar la página
window.addEventListener('load', loadExistingQRs);

function startScanning() {
  const user = getUser();
  if (!user) {
    setStatus('Selecciona un usuario primero.', true);
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Cámara no soportada.', true);
    return;
  }

  scanning = true;
  document.getElementById('startScan').style.display = 'none';
  document.getElementById('stopScan').style.display = 'block';
  setStatus('Escaneando... Apunta al QR.');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(mediaStream => {
      stream = mediaStream;
      video.srcObject = stream;
      video.play();
      requestAnimationFrame(scanQR);
    })
    .catch(err => {
      setStatus('Error de cámara: ' + err.message, true);
    });
}

function stopScanning() {
  scanning = false;
  document.getElementById('startScan').style.display = 'block';
  document.getElementById('stopScan').style.display = 'none';
  setStatus('');
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

function scanQR() {
  if (!scanning) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      qrData = code.data.trim();
      document.getElementById('qrData').textContent = qrData;
      document.getElementById('result').style.display = 'block';
      stopScanning();
      setStatus('QR detectado. Verificando...');
      verifyAndSaveQR();  // Verificar y guardar
      return;
    }
  }
  requestAnimationFrame(scanQR);
}

async function verifyAndSaveQR() {
  if (existingQRs.has(qrData)) {
    setStatus('DUPLICADO: Este QR ya fue registrado anteriormente.', true);
    document.getElementById('sendToGoogle').disabled = true;
    return;
  }

  const user = getUser();
  const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(user)}`;

  // Enviar al servidor (respaldo)
  fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  }).then(() => {
    existingQRs.add(qrData);  // Agregar a local
    setStatus(`ÉXITO: ${user} registró: ${qrData}`);
    document.getElementById('sendToGoogle').disabled = true;
  }).catch(err => {
    setStatus('Error de red, pero QR nuevo. Verifica manualmente.', true);
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
  data += `"${timestamp}","${user}","${qrData.replace(/"/g, '""')}"\n`;
  localStorage.setItem('qrList', data);

  const csv = 'data:text/csv;charset=utf-8,Fecha_Hora,Usuario,Datos_QR\n' + data;
  const link = document.createElement('a');
  link.href = encodeURI(csv);
  link.download = 'qr_lecturas.csv';
  link.click();
  setStatus('CSV descargado (respaldo local)');
}
