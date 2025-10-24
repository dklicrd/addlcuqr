let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;

// URL de tu Apps Script (validada y funcional)
const scriptUrl = 'https://script.google.com/macros/s/AKfycbyjYTCdWr_34INkN0GoxI5w-HhGc-vS8glz20XZetlao7cMF0HPyNXzf-Umsw5XN8wq/exec';

// Conjunto para evitar duplicados localmente
let scannedQRs = new Set();

// Cargar QRs existentes al iniciar la app
async function loadExistingQRs() {
  try {
    const response = await fetch(scriptUrl);
    const data = await response.json();
    if (data.qrs && Array.isArray(data.qrs)) {
      data.qrs.forEach(qr => scannedQRs.add(qr));
    }
  } catch (err) {
    console.warn('No se pudieron cargar QRs previos:', err);
  }
}

// Al cargar la página
window.addEventListener('load', () => {
  loadExistingQRs();
});

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
  setStatus('Escaneando... Apunta al código QR.');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(mediaStream => {
      stream = mediaStream;
      video.srcObject = stream;
      video.play();
      requestAnimationFrame(scanQR);
    })
    .catch(err => {
      setStatus('Error de cámara: ' + err.message, true);
      stopScanning();
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
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      qrData = code.data;
      document.getElementById('qrData').textContent = qrData;
      document.getElementById('result').style.display = 'block';
      stopScanning();
      setStatus('QR detectado. Verifica y envía.');

      // Verificar duplicado localmente
      if (scannedQRs.has(qrData)) {
        setStatus('Este QR ya fue registrado anteriormente.', true);
        document.getElementById('sendToGoogle').disabled = true;
      } else {
        document.getElementById('sendToGoogle').disabled = false;
      }
      return;
    }
  }
  requestAnimationFrame(scanQR);
}

function sendToGoogleForm() {
  if (!qrData) {
    setStatus('Error: No hay datos de QR.', true);
    return;
  }

  const user = getUser();
  if (!user) {
    setStatus('Selecciona un usuario.', true);
    return;
  }

  // Verificación local (redundante, pero rápida)
  if (scannedQRs.has(qrData)) {
    setStatus('Este QR ya fue registrado.', true);
    return;
  }

  const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(user)}`;

  fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  })
  .then(() => {
    // Agregar al conjunto local
    scannedQRs.add(qrData);
    setStatus(`ÉXITO: ${user} registró: ${qrData}`);
    document.getElementById('sendToGoogle').disabled = true;
  })
  .catch(err => {
    setStatus('Error de red: ' + err.message, true);
  });
}

function saveToCSV() {
  if (!qrData) return;

  const user = getUser() || 'Anónimo';
  const timestamp = new Date().toLocaleString('es-ES');
  let data = localStorage.getItem('qrList') || '';
  data += `"${timestamp}","${user}","${qrData.replace(/"/g, '""')}"\n`;
  localStorage.setItem('qrList', data);

  const csv = 'data:text/csv;charset=utf-8,Fecha_Hora,Usuario,Datos_QR\n' + data;
  const link = document.createElement('a');
  link.href = encodeURI(csv);
  link.download = `qr_lecturas_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setStatus('CSV descargado con respaldo local');
}
