let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;

const scriptUrl = 'https://script.google.com/macros/s/AKfycbyjYTCdWr_34INkN0GoxI5w-HhGc-vS8glz20XZetlao7cMF0HPyNXzf-Umsw5XN8wq/exec';

document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
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
  document.getElementById('result').style.display = 'none';
  setStatus('Escaneando...');

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
  if (stream) stream.getTracks().forEach(track => track.stop());
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
      setStatus('QR detectado. Verificando y guardando...');

      // Envío automático
      autoSaveQR();
      return;
    }
  }
  requestAnimationFrame(scanQR);
}

async function autoSaveQR() {
  const user = getUser();
  if (!user || !qrData) return;

  const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(user)}`;

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors',  // Para leer respuesta
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    });

    const text = await response.text();

    if (text.includes('SUCCESS')) {
      setStatus(`ÉXITO: ${user} registró: ${qrData}`);
    } else if (text.includes('DUPLICATE')) {
      setStatus('DUPLICADO: Este QR ya fue registrado.', true);
    } else {
      setStatus('Error: ' + text, true);
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
