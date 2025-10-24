let currentUser = '';
let userEmail = '';
let userAvatar = '';
const scriptUrl = 'https://script.google.com/macros/s/AKfycby6xgh20  /* TU URL */';

// Google Sign-In
function handleCredentialResponse(response) {
  const data = JSON.parse(atob(response.credential.split('.')[1]));
  currentUser = data.name;
  userEmail = data.email;
  userAvatar = data.picture;

  document.getElementById('currentUser').textContent = currentUser;
  document.getElementById('userAvatar').src = userAvatar;
  document.getElementById('userInfo').style.display = 'block';
  document.getElementById('googleSignIn').style.display = 'none';
  document.getElementById('exportMyData').style.display = 'block';
}

function logout() {
  google.accounts.id.disableAutoSelect();
  currentUser = userEmail = userAvatar = '';
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('googleSignIn').style.display = 'block';
  document.getElementById('exportMyData').style.display = 'none';
}

// Exportar datos del usuario
document.getElementById('exportMyData').addEventListener('click', () => {
  if (!userEmail) return;

  const sheetUrl = `https://docs.google.com/spreadsheets/d/1wCkiZ3bjMWOTmXQiXVWANZ8UlIDy6TTvaMlgXWwFEwc/export?format=csv&gid=0`;
  
  fetch(sheetUrl)
    .then(r => r.text())
    .then(csv => {
      const lines = csv.split('\n');
      const headers = lines[0];
      const userRows = lines.slice(1).filter(row => row.includes(userEmail));
      const userCsv = [headers, ...userRows].join('\n');
      
      const blob = new Blob([userCsv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mis_lecturas_${userEmail.split('@')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      setStatus(`Exportado: ${userRows.length} lecturas`);
    });
});

// Enviar con usuario
function sendToGoogleForm() {
    if (!qrData) {
        setStatus('Error: No hay datos para enviar.', true);
        return;
    }
    if (!currentUser) {
        setStatus('Debes iniciar sesión con Google.', true);
        return;
    }

    const payload = `qrData=${encodeURIComponent(qrData)}&user=${encodeURIComponent(userEmail)}`;

    fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload
    }).then(() => {
        setStatus(`ÉXITO: ${currentUser} registró: ${qrData}`, false);
    });
}

// Carga inicial
window.onload = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
};
