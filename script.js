let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scanning = false;
let qrData = '';
let stream = null;

// Configuración para Google Form (reemplaza con tus valores exactos)
const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSd53K1i0kxun-7FvG39My4-cmX86a3C1qQE5scna7jCtca/formResponse'; // URL de acción extraída de la imagen
const googleFieldName = 'entry.123456789'; // Reemplaza con el valor real (ej: entry.2005620554) obtenido inspeccionando el input

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

    if (!googleFormUrl.includes('formResponse') || !googleFieldName.startsWith('entry.')) {
        setStatus('Error: Configura correctamente googleFormUrl y googleFieldName en script.js. Inspecciona el formulario para obtenerlos.', true);
        return;
    }

    let formData = new FormData();
    formData.append(googleFieldName, qrData);

    fetch(googleFormUrl, {
        method: 'POST',
        body: formData,
        mode: 'no-cors'
    }).then(() => {
        setStatus('Datos enviados a Google Form. Verifica la pestaña "Respuestas" en tu formulario (refresca si es necesario).');
    }).catch(err => {
        setStatus('Error al enviar a Google Form: ' + err.message + '. Verifica la URL, el nombre del campo y los permisos del formulario.', true);
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
