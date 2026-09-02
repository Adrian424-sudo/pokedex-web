// audio.js
// Responsable de reproducir el sonido (cry) de un Pokémon.
// El sonido NUNCA se reproduce automáticamente: solo por interacción directa del usuario
// (clic en el botón de sonido de una tarjeta).

// Guarda una referencia al audio que está sonando actualmente (o null si no hay ninguno).
// Se declara fuera de la función para que "recuerde" su valor entre llamadas.
let currentAudio = null;

/**
 * Reproduce el cry de un Pokémon. Si ya hay un audio sonando, lo detiene primero.
 * @param {string} cryUrl - URL del archivo de audio a reproducir
 * @param {HTMLButtonElement} button - botón que disparó la acción (para feedback visual)
 */
export function playCry(cryUrl, button) {
  // Si no hay URL de sonido (Pokémon sin cry disponible), no se hace nada
  if (!cryUrl) return;

  // Si ya había un audio reproduciéndose, se pausa y se reinicia su posición a 0
  // para no tener dos sonidos sobrepuestos al mismo tiempo
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  // Se crea un nuevo objeto Audio con la URL del cry
  currentAudio = new Audio(cryUrl);
  // Se agrega una clase CSS al botón para poder darle un estilo "reproduciendo" si se desea
  button.classList.add("playing");

  // Se intenta reproducir el audio. Los navegadores devuelven una Promise que puede
  // rechazarse (por ejemplo, si el usuario bloqueó el autoplay o hay un error de red)
  currentAudio.play().catch(() => {
    // Si falla la reproducción, se quita la clase "playing" y se avisa al usuario
    button.classList.remove("playing");
    alert("No se pudo reproducir el sonido de este Pokémon.");
  });

  // Cuando el audio termina de sonar por completo, se quita la clase "playing" del botón
  currentAudio.addEventListener("ended", () => {
    button.classList.remove("playing");
  });
}
