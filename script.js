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
  setStatus('Escaneando...');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(s => {
      stream = s;
      video.srcObject = stream;
      video.play();
      requestAnimationFrame(scanQR);
    })
诀.catch(() => setStatus('Error de cámara.', true));
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
    setStatus('QR detectado. Enviando...');
    sendToGoogleForm();
  } else {
    requestAnimationFrame(scanQR);
  }
}

async function sendToGoogleForm() {
  if (!qrData || !getUser()) return;

  const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(getUser())}`;

  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors', // LEE LA RESPUESTA
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    });

    const data = await res.json();

    if (data.status === 'success') {
      setStatus(`${getUser()} registró: ${qrData}`);
      document.getElementById('sendToGoogle').disabled = true;
    } else if (data.status === 'duplicate') {
      setStatus('DUPLICADO: Este QR ya fue registrado.', true);
    } else {
      setStatus('Error: ' + (data.message || 'Desconocido'), true);
    }
  } catch (err) {
    setStatus('Error de red: ' + err.message, true);
  }
}

function saveToCSV() {
  if (!qrData) return;
  const csv = `data:text/csv;charset=utf-8,Fecha,Usuario,QR\n${new Date().toLocaleString()},${getUser() || 'Anónimo'},${qrData}`;
  const a = document.createElement('a');
  a.href = encodeURI(csv);
  a.download = 'qr.csv';
  a.click();
}
