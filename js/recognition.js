// recognition.js
// Responsable de cargar el modelo de reconocimiento visual (Teachable Machine)
// y de predecir a partir de la región del video delimitada por el cuadro (reticle).
//
// El modelo fue entrenado en Teachable Machine (https://teachablemachine.withgoogle.com/)
// con 3 clases (bulbasaur, charmander, squirtle) + una clase de fondo/no-escaneado.

// URL pública del modelo ya entrenado y exportado desde Teachable Machine.
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/P669RM3tt/";

// Únicos Pokémon que la app debe reconocer y consultar en la PokéAPI.
// Cualquier otra clase del modelo (ej. "fondo" / "no escaneado") se ignora.
const RECOGNIZABLE_POKEMON = ["bulbasaur", "charmander", "squirtle"];

// Confianza mínima (0 a 1) que debe tener una predicción para considerarse válida.
// 0.85 = 85% de seguridad del modelo.
const CONFIDENCE_THRESHOLD = 0.85;

// Cuántas predicciones consecutivas iguales se necesitan para confirmar
// un resultado. Esto evita falsos positivos por un solo frame ruidoso.
const CONSECUTIVE_FRAMES_REQUIRED = 5;

// Tamaño del cuadro de enfoque en pantalla (debe coincidir con el w-48 h-48
// del reticle en index.html: 12rem = 192px).
const RETICLE_SIZE_PX = 192;

// Tamaño (cuadrado) al que se reescala el recorte antes de pasarlo al modelo.
// 224x224 es el tamaño estándar de entrada que usan los modelos de Teachable Machine.
const CROP_CANVAS_SIZE = 224;

// ---------- Variables de estado del módulo ----------
// (se guardan fuera de las funciones para persistir entre llamadas y frames)

let model = null; // Referencia al modelo ya cargado (null hasta que se carga por primera vez)
let predictionLoopId = null; // id devuelto por requestAnimationFrame, para poder cancelarlo
let lastConfirmed = null; // último Pokémon ya confirmado (evita solicitudes repetidas)
let streakClassName = null; // nombre de la clase que se está acumulando en la racha actual
let streakCount = 0; // cuántos frames consecutivos ha dado la misma predicción

// Canvas oculto (no se agrega a la página) donde se dibuja el recorte del video
// antes de pasárselo al modelo de Teachable Machine.
let cropCanvas = null;
let cropCtx = null;

/**
 * Crea (una sola vez) el canvas oculto usado para recortar el frame del video.
 */
function getCropCanvas() {
  if (!cropCanvas) {
    cropCanvas = document.createElement("canvas");
    cropCanvas.width = CROP_CANVAS_SIZE;
    cropCanvas.height = CROP_CANVAS_SIZE;
    cropCtx = cropCanvas.getContext("2d");
  }
  return cropCanvas;
}

/**
 * Calcula, en coordenadas reales de píxeles del video, la región que
 * corresponde al cuadro de enfoque mostrado en pantalla (que puede ser más
 * chico que el video real debido a object-fit: cover).
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLElement} frameEl - contenedor visible que envuelve al <video>
 */
function computeCropBox(videoEl, frameEl) {
  // Dimensiones reales del stream de video (resolución de la cámara)
  const videoW = videoEl.videoWidth;
  const videoH = videoEl.videoHeight;
  // Dimensiones del contenedor tal como se ve en pantalla (puede ser distinto al video real)
  const frameW = frameEl.clientWidth;
  const frameH = frameEl.clientHeight;

  // object-fit: cover -> el video se escala (manteniendo proporción) para cubrir
  // completamente el frame, recortando lo que sobre. "scale" es ese factor de escala.
  const scale = Math.max(frameW / videoW, frameH / videoH);
  // Ancho y alto que el video ocupa realmente en pantalla una vez escalado
  const displayedW = videoW * scale;
  const displayedH = videoH * scale;
  // Cuánto del video "se sale" del frame por cada lado (porque cover recorta el sobrante)
  const offsetX = (displayedW - frameW) / 2;
  const offsetY = (displayedH - frameH) / 2;

  // Posición del reticle (cuadro de enfoque), centrado dentro del frame visible
  const reticleFrameX = (frameW - RETICLE_SIZE_PX) / 2;
  const reticleFrameY = (frameH - RETICLE_SIZE_PX) / 2;

  // Se convierte la posición del reticle de "espacio pantalla" a "espacio video real",
  // sumando el offset que el cover recortó y dividiendo entre el factor de escala
  const sx = (reticleFrameX + offsetX) / scale;
  const sy = (reticleFrameY + offsetY) / scale;
  const sSize = RETICLE_SIZE_PX / scale;

  // sx, sy, sSize son las coordenadas y tamaño (en píxeles reales del video)
  // que hay que recortar para obtener exactamente lo que el usuario ve dentro del reticle
  return { sx, sy, sSize };
}

/**
 * Dibuja en el canvas oculto solo la porción del video que cae dentro del
 * cuadro de enfoque, lista para pasarse al modelo.
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLElement} frameEl
 */
function drawCroppedFrame(videoEl, frameEl) {
  const canvas = getCropCanvas();
  const { sx, sy, sSize } = computeCropBox(videoEl, frameEl);
  // drawImage con 9 argumentos: recorta un cuadro (sx,sy,sSize,sSize) del video de origen
  // y lo dibuja reescalado para llenar todo el canvas de destino (0,0,CROP_CANVAS_SIZE,CROP_CANVAS_SIZE)
  cropCtx.drawImage(videoEl, sx, sy, sSize, sSize, 0, 0, CROP_CANVAS_SIZE, CROP_CANVAS_SIZE);
  return canvas;
}

/**
 * Carga el modelo de Teachable Machine (una sola vez; llamadas posteriores
 * devuelven el mismo modelo ya cargado en memoria).
 */
export async function loadRecognitionModel() {
  // Si ya se había cargado antes, se reutiliza sin volver a descargarlo
  if (model) return model;
  // Teachable Machine expone el modelo como dos archivos: la arquitectura (model.json)
  // y los metadatos con los nombres de las clases (metadata.json)
  const modelURL = MODEL_URL + "model.json";
  const metadataURL = MODEL_URL + "metadata.json";
  // tmImage viene de la librería @teachablemachine/image cargada por <script> en index.html
  model = await tmImage.load(modelURL, metadataURL);
  return model;
}

/**
 * Inicia un ciclo de predicción continua sobre la región del video delimitada
 * por el cuadro de enfoque (frameEl = contenedor del video).
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLElement} frameEl - contenedor que define el área visible de la cámara
 * @param {(label: string, confidence: number) => void} onDetected - se llama al confirmar un Pokémon
 * @param {() => void} onNoneDetected - se llama cuando no hay nada reconocible en el frame
 * @param {(label: string, streak: number, required: number) => void} onProgress - progreso de confirmación
 * @param {(err: Error) => void} [onError] - se llama si falla la predicción en algún frame (opcional)
 */
export async function startPredictionLoop(videoEl, frameEl, onDetected, onNoneDetected, onProgress, onError) {
  // Si el modelo aún no se ha cargado, se carga antes de empezar a predecir
  if (!model) await loadRecognitionModel();
  // Se reinicia todo el estado de "racha" cada vez que se inicia un nuevo ciclo
  streakClassName = null;
  streakCount = 0;
  lastConfirmed = null;

  // Función recursiva que se ejecuta una vez por cada frame de animación del navegador
  async function loop() {
    // Solo se predice si el video ya tiene dimensiones reales (evita errores al iniciar)
    if (videoEl.videoWidth > 0) {
      // Todo el bloque de predicción se envuelve en try/catch: si el modelo o el canvas
      // fallan en algún frame (por ejemplo, un frame corrupto o un error interno de
      // TensorFlow.js), el error se captura aquí en vez de detener el ciclo en silencio.
      try {
        // 1. Se recorta la región del reticle y se dibuja en el canvas oculto
        const croppedFrame = drawCroppedFrame(videoEl, frameEl);
        // 2. Se le pasa ese recorte al modelo, que devuelve la probabilidad de cada clase
        const predictions = await model.predict(croppedFrame);
        // 3. Se busca cuál de todas las clases tuvo la mayor probabilidad
        const best = predictions.reduce((max, p) => (p.probability > max.probability ? p : max));

        // Nombre de la clase detectada, normalizado a minúsculas y sin espacios extra
        const detectedName = best.className.toLowerCase().trim();
        // Se verifica que la clase detectada sea uno de los 3 Pokémon que nos interesan
        // (y no, por ejemplo, la clase de "fondo" que también entrenó el modelo)
        const isRecognizablePokemon = RECOGNIZABLE_POKEMON.includes(detectedName);
        // Solo se considera válida si supera el umbral de confianza Y es un Pokémon reconocible
        const passesThreshold = best.probability >= CONFIDENCE_THRESHOLD && isRecognizablePokemon;

        if (passesThreshold) {
          // Si la clase detectada es la misma que se venía acumulando, se suma un frame más a la racha
          if (streakClassName === detectedName) {
            streakCount++;
          } else {
            // Si cambió la clase detectada, se reinicia la racha con la nueva clase
            streakClassName = detectedName;
            streakCount = 1;
          }

          // Si ya se alcanzó el número de frames consecutivos requeridos Y no se había
          // confirmado ya este mismo Pokémon, se dispara la confirmación (onDetected)
          if (streakCount >= CONSECUTIVE_FRAMES_REQUIRED && lastConfirmed !== detectedName) {
            lastConfirmed = detectedName;
            onDetected(detectedName, best.probability);
          } else if (lastConfirmed !== detectedName && onProgress) {
            // Mientras no se llega al mínimo de frames, se informa el progreso (ej. "3/5")
            onProgress(detectedName, streakCount, CONSECUTIVE_FRAMES_REQUIRED);
          }
        } else {
          // Si no se detectó nada válido en este frame, se reinicia toda la racha
          // y se permite volver a confirmar el mismo Pokémon si vuelve a aparecer después
          streakClassName = null;
          streakCount = 0;
          lastConfirmed = null;
          onNoneDetected();
        }
      } catch (err) {
        // Si algo falla durante la predicción de este frame, se reinicia la racha
        // (igual que si no se hubiera detectado nada) y se avisa mediante onError,
        // sin detener el ciclo: se sigue intentando en el siguiente frame.
        streakClassName = null;
        streakCount = 0;
        lastConfirmed = null;
        if (onError) onError(err);
      }
    }

    // Se programa la siguiente predicción para el próximo frame de animación
    // (requestAnimationFrame se sincroniza con la tasa de refresco del navegador)
    predictionLoopId = requestAnimationFrame(loop);
  }

  // Se dispara la primera iteración del ciclo
  loop();
}

/**
 * Detiene el ciclo de predicción y reinicia todo el estado interno del módulo.
 */
export function stopPredictionLoop() {
  if (predictionLoopId) {
    // Cancela el próximo frame programado, deteniendo el ciclo de predicción
    cancelAnimationFrame(predictionLoopId);
    predictionLoopId = null;
  }
  streakClassName = null;
  streakCount = 0;
  lastConfirmed = null;
}
