// camera.js
// Responsable único de solicitar permiso y controlar el stream de la cámara.
// Usa la API estándar de navegadores: navigator.mediaDevices.getUserMedia

// Guarda el stream de video activo (o null si la cámara está apagada).
// Se declara fuera de las funciones para que persista mientras la cámara esté encendida.
let activeStream = null;

/**
 * Revisa si el dispositivo tiene al menos una cámara disponible.
 * Esto permite avisarle al usuario ANTES de pedirle permiso, si de plano no hay cámara.
 */
export async function hasCameraDevice() {
  // Si el navegador no soporta enumerar dispositivos, se asume que no hay cámara
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  // Lista todos los dispositivos multimedia (cámaras, micrófonos, etc.)
  const devices = await navigator.mediaDevices.enumerateDevices();
  // Devuelve true si al menos uno de esos dispositivos es de tipo "videoinput" (cámara)
  return devices.some((d) => d.kind === "videoinput");
}

/**
 * Solicita permiso y comienza a transmitir la cámara en el elemento <video> dado.
 * @param {HTMLVideoElement} videoEl - elemento <video> donde se mostrará el stream
 * @returns {Promise<{ok: boolean, reason?: string}>} resultado de la operación
 */
export async function startCamera(videoEl) {
  // Si el navegador no soporta getUserMedia, no hay forma de continuar
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unsupported" };
  }

  // Verifica primero si existe una cámara física antes de pedir permiso
  const cameraAvailable = await hasCameraDevice();
  if (!cameraAvailable) {
    return { ok: false, reason: "no-camera" };
  }

  try {
    // Pide permiso al usuario y obtiene el stream de video.
    // facingMode: "environment" prefiere la cámara trasera (en celulares); en laptops
    // sin cámara trasera, el navegador simplemente usa la única cámara disponible.
    activeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    // Conecta el stream obtenido al elemento <video> para que se vea en pantalla
    videoEl.srcObject = activeStream;
    return { ok: true };
  } catch (err) {
    // Si el usuario rechazó el permiso explícitamente, se distingue ese caso
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return { ok: false, reason: "permission-denied" };
    }
    // Cualquier otro error (cámara ocupada, error de hardware, etc.)
    return { ok: false, reason: "error" };
  }
}

/**
 * Detiene todos los tracks del stream activo (apaga la cámara físicamente).
 * @param {HTMLVideoElement} videoEl
 */
export function stopCamera(videoEl) {
  if (activeStream) {
    // getTracks() devuelve los canales de video (y audio, si los hubiera);
    // stop() en cada uno apaga la cámara de verdad (se apaga el LED físico del dispositivo)
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
  if (videoEl) {
    // Desconecta el stream del elemento <video> para que deje de mostrar la imagen
    videoEl.srcObject = null;
  }
}

/**
 * Indica si la cámara está actualmente encendida.
 */
export function isCameraActive() {
  return activeStream !== null;
}
