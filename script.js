let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;

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
  setStatus('Escaneando...');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(mediaStream => {
      stream = mediaStream;
      video.srcObject = stream;
      video.play();
      requestAnimationFrame(scanQR);
    })
    .catch(err => setStatus('Error de cámara: ' + err.message, true));
}

function stopScanning() {
  scanning = false;
  document.getElementById('startScan').style.display = 'block';
  document.getElementById('stopScan').style.display = 'none';
  setStatus('');
  if (stream) stream.getTracks().forEach(t => t.stop());
}

function scanQR() {
  if (!scanning) return;
  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(scanQR);
    return;
  }

  canvas.height = video.videoHeight;
  canvas.width = video.videoWidth;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);

  if (code) {
    qrData = code.data.trim();
    document.getElementById('qrData').textContent = qrData;
    document.getElementById('result').style.display = 'block';
    stopScanning();
    setStatus('QR detectado. Enviando...');
    sendToGoogleForm(); // Envío automático
  } else {
    requestAnimationFrame(scanQR);
  }
}

async function sendToGoogleForm() {
  if (!qrData) return;

  const user = getUser();
  if (!user) {
    setStatus('Selecciona un usuario.', true);
    return;
  }

  const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(user)}`;

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors', // CAMBIADO A CORS PARA LEER RESPUESTA
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    });

    const result = await response.json();

    if (result.status === 'success') {
      setStatus(`ÉXITO: ${user} registró: ${qrData}`);
      document.getElementById('sendToGoogle').disabled = true;
    } else if (result.status === 'duplicate') {
      setStatus('Este QR ya fue registrado anteriormente.', true);
    } else {
      setStatus('Error: ' + (result.message || 'Desconocido'), true);
    }
  } catch (err) {
    setStatus('Error de red: ' + err.message, true);
  }
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
  link.download = 'qr_lecturas.csv';
  link.click();
  setStatus('CSV descargado');
}
