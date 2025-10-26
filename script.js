let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;
let existingQRs = new Set();

const scriptUrl = 'https://script.google.com/macros/s/AKfycbyjYTCdWr_34INkN0GoxI5w-HhGc-vS8glz20XZetlao7cMF0HPyNXzf-Umsw5XN8wq/exec';

window.addEventListener('load', () => {
  loadExistingQRs();
});

document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
document.getElementById('saveToCSV').addEventListener('click', saveToCSV);

function setStatus(message, isError = false) {
  document.getElementById('status').textContent = message;
  document.getElementById('status').style.color = isError ? 'red' : 'black';
}

function getUser() {
  return document.getElementById('userSelect').value;
}

function getProject() {
  return document.getElementById('projectSelect').value;
}

async function loadExistingQRs() {
  try {
    const response = await fetch(scriptUrl);
    const text = await response.text();
    if (text && text !== 'ERROR') {
      const qrs = text.split('|').map(q => q.trim()).filter(Boolean);
      existingQRs = new Set(qrs);
      setStatus(`Cargados ${qrs.length} códigos existentes.`);
    }
  } catch (err) {
    console.warn('Error cargando QRs:', err);
  }
}

function startScanning() {
  const user = getUser();
  const project = getProject();
  if (!user || !project) {
    setStatus('Selecciona usuario y proyecto.', true);
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
      qrData = code.data;
      document.getElementById('qrData').textContent = qrData;
      document.getElementById('result').style.display = 'block';
      stopScanning();
      setStatus('QR detectado!');
      autoSaveQR();  // Envío automático
      return;
    }
  }
  requestAnimationFrame(scanQR);
}

async function autoSaveQR() {
  const user = getUser();
  const project = getProject();
  if (!qrData || !user || !project) return;

  if (existingQRs.has(qrData)) {
    setStatus('DUPLICADO: Este código ya fue registrado.', true);
    return;
  }

  const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(user)}&project=${encodeURIComponent(project)}`;

  fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  }).then(() => {
    existingQRs.add(qrData);
    setStatus(`ÉXITO: ${user} registró: ${qrData} en ${project}`);
  }).catch(err => {
    setStatus('Error de red: ' + err.message, true);
  });
}

function saveToCSV() {
  if (!qrData) return;
  const user = getUser() || 'Anónimo';
  const project = getProject() || 'Sin proyecto';
  const timestamp = new Date().toLocaleString('es-ES');
  let data = localStorage.getItem('qrList') || '';
  data += `"${timestamp}","${project}","${user}","${qrData.replace(/"/g, '""')}"\n`;
  localStorage.setItem('qrList', data);

  const csv = 'data:text/csv;charset=utf-8,Fecha_Hora,Proyecto,Usuario,Datos\n' + data;
  const link = document.createElement('a');
  link.href = encodeURI(csv);
  link.download = 'qr_data.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setStatus('CSV descargado');
}
