let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;

// Configuración para Google Form (valores extraídos del HTML proporcionado)
const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSd53K1i0kxun-7FvG39My4-cmX86a3C1qQE5scna7jCtca/formResponse';
const googleFieldName = 'entry.570948853';

document.getElementById('startScan').addEventListener('click', startScanning);
document.getElementById('stopScan').addEventListener('click', stopScanning);
document.getElementById('sendToGoogle').addEventListener('click', sendToGoogleForm);
document.getElementById('saveToCSV').addEventListener('click', saveToCSV);

function setStatus(message, isError = false) {
    document.getElementById('status').textContent = message;
    document.getElementById('status').style.color = isError ? 'red' : 'black';
}

function startScanning() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('Error: Este navegador no soporta acceso a la cámara.', true);
        return;
    }

    if (!window.jsQR) {
        setStatus('Error: Librería jsQR no cargada. Verifica la conexión o el archivo jsQR.js.', true);
        return;
    }

    scanning = true;
    document.getElementById('startScan').style.display = 'none';
    document.getElementById('stopScan').style.display = 'block';
    setStatus('Escaneando... Apunta la cámara al QR.');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(mediaStream => {
            stream = mediaStream;
            video.srcObject = stream;
            video.play().catch(err => setStatus('Error al reproducir video: ' + err.message, true));
            requestAnimationFrame(scanQR);
        })
        .catch(err => {
            setStatus('Error al acceder a la cámara: ' + err.message, true);
            if (err.name === 'NotAllowedError') {
                setStatus('Permiso de cámara denegado. Habilita los permisos en tu navegador.', true);
            } else if (err.name === 'NotFoundError') {
                setStatus('No se encontró una cámara en el dispositivo.', true);
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
            setStatus('QR detectado!');
            return;
        }
    } else {
        setStatus('Cámara no lista, esperando datos...', true);
    }
    requestAnimationFrame(scanQR);
}

function sendToGoogleForm() {
    if (!qrData) {
        setStatus('Error: No hay datos de QR para enviar.', true);
        return;
    }

    // Reemplaza esta URL con la que obtuviste en el paso 3
    const scriptUrl = 'https://script.google.com/macros/s/AKfycby6xgh20D0UOHgTRJQhZUC0gej0JtNy6XEQRNcoJAs0C_gViDj6ug0lrhA3iY9Orv7w/exec';

    const payload = `qrData=${encodeURIComponent(qrData)}`;

    fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload
    }).then(() => {
        setStatus('Datos enviados a Google Sheet. Revisa la hoja "Registro QR".');
    }).catch(err => {
        setStatus('Error de red: ' + err.message, true);
    });
}

function saveToCSV() {
    if (!qrData) {
        setStatus('Error: No hay datos de QR para guardar.', true);
        return;
    }

    let storedData = localStorage.getItem('qrDataList') || '';
    storedData += qrData + '\n';
    localStorage.setItem('qrDataList', storedData);

    let csvContent = "data:text/csv;charset=utf-8,QR_Data\n" + storedData;
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "qr_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus('CSV descargado. Ábrelo en Excel.');
}


