let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;

// URL de tu Apps Script (YA CONFIGURADA)
const scriptUrl = 'https://script.google.com/macros/s/AKfycby6xgh20D0UOHgTRJQhZUC0gej0JtNy6XEQRNcoJAs0C_gViDj6ug0lrhA3iY9Orv7w/exec';

document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
document.getElementById('sendToGoogle').addEventListener('click', sendToGoogleForm);
document.getElementById('saveToCSV').addEventListener('click', saveToCSV);

function setStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.style.color = isError ? 'red' : '#4CAF50';
}

function startScanning() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('Error: Cámara no soportada.', true);
        return;
    }

    if (!window.jsQR) {
        setStatus('Error: Librería jsQR no cargada.', true);
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
            video.play().catch(err => setStatus('Error al iniciar video: ' + err.message, true));
            requestAnimationFrame(scanQR);
        })
        .catch(err => {
            setStatus('Error de cámara: ' + err.message, true);
            if (err.name === 'NotAllowedError') {
                setStatus('Permiso denegado. Habilita la cámara.', true);
            }
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
            qrData = code.data;
            document.getElementById('qrData').textContent = qrData;
            document.getElementById('result').style.display = 'block';
            stopScanning();
            setStatus('QR detectado correctamente');
            return;
        }
    }
    requestAnimationFrame(scanQR);
}

function sendToGoogleForm() {
    if (!qrData) {
        setStatus('Error: No hay datos para enviar.', true);
        return;
    }

    const payload = `qrData=${encodeURIComponent(qrData)}`;

    fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload
    }).then(() => {
        setStatus('ÉXITO: Datos guardados en Google Sheet "Registro QR"', false);
    }).catch(err => {
        setStatus('Error de red: ' + err.message, true);
    });
}

function saveToCSV() {
    if (!qrData) return;

    const timestamp = new Date().toLocaleString('es-ES');
    let data = localStorage.getItem('qrList') || '';
    data += `"${timestamp}","${qrData.replace(/"/g, '""')}"\n`;
    localStorage.setItem('qrList', data);

    const csv = 'data:text/csv;charset=utf-8,Fecha_Hora,Datos_QR\n' + data;
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `qr_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus('CSV descargado (respaldo local)');
}
