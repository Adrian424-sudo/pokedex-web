// main.js
// Punto de entrada de la aplicación: conecta todos los módulos entre sí,
// escucha los eventos del usuario y maneja el estado general de la app.

// Se importan solo las funciones que este archivo necesita de cada módulo
import { fetchPokemonList, fetchPokemonDetails, fetchPokemonDetail } from "./api.js";
import { renderCardsGrid, renderSkeletons, createPokemonCard } from "./cards.js";
import { startCamera, stopCamera, isCameraActive } from "./camera.js";
import { loadRecognitionModel, startPredictionLoop, stopPredictionLoop } from "./recognition.js";

// ---------- Referencias a los elementos del DOM ----------
// Se buscan una sola vez al cargar el script y se reutilizan en todas las funciones.

// Botones de navegación (CATÁLOGO / RECONOCIMIENTO) y las dos vistas que muestran/ocultan
const tabButtons = document.querySelectorAll(".tab-btn");
const views = document.querySelectorAll(".view");

// Elementos de la vista Catálogo
const cardsContainer = document.getElementById("cards-container");
const errorEl = document.getElementById("catalog-error");
const searchInput = document.getElementById("search-input");
const prevBtn = document.getElementById("prev-page");
const nextBtn = document.getElementById("next-page");
const pageIndicator = document.getElementById("page-indicator");
const matchesFoundEl = document.getElementById("matches-found");
const recentListEl = document.getElementById("recent-list");
const systemStatusEl = document.getElementById("system-status");

// Elementos de la vista Reconocimiento
const videoEl = document.getElementById("camera-feed");
const cameraFrameEl = document.getElementById("camera-frame-container");
const cameraToggleBtn = document.getElementById("camera-toggle-btn");
const cameraMessage = document.getElementById("camera-message");
const cameraStatusLabel = document.getElementById("camera-status-label");
const cameraLed = document.getElementById("camera-led");
const focusReticle = document.getElementById("focus-reticle");
const recognitionState = document.getElementById("recognition-state");
const scanResultBox = document.getElementById("scan-result");
const resultCardContent = document.getElementById("result-card-content");

// ---------- Estado de la aplicación ----------
const PAGE_SIZE = 8; // cuántos Pokémon se muestran por página en el catálogo
let currentPage = 0; // página actual del catálogo (empieza en 0)
let fullPokemonCache = []; // detalle de los Pokémon de la página actualmente cargada
const recentSearches = []; // historial de búsquedas exitosas (máx. 5, ver addRecent)

// Clases Tailwind que distinguen visualmente la pestaña activa de la inactiva
const ACTIVE_TAB_CLASSES = ["bg-on-primary-fixed", "text-primary-fixed-dim"];
const INACTIVE_TAB_CLASSES = ["text-on-primary", "hover:bg-on-primary-fixed/40"];

// ---------- Navegación entre vistas (pestañas CATÁLOGO / RECONOCIMIENTO) ----------
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Primero se les quita el estilo "activo" a TODOS los botones...
    tabButtons.forEach((b) => {
      b.classList.remove(...ACTIVE_TAB_CLASSES);
      b.classList.add(...INACTIVE_TAB_CLASSES);
    });
    // ...y se ocultan TODAS las vistas (catálogo y reconocimiento)
    views.forEach((v) => v.classList.add("hidden"));

    // Después, se le da el estilo "activo" solo al botón que se acaba de presionar...
    btn.classList.add(...ACTIVE_TAB_CLASSES);
    btn.classList.remove(...INACTIVE_TAB_CLASSES);
    // ...y se muestra únicamente la vista cuyo id coincide con el atributo data-view del botón
    document.getElementById(btn.dataset.view).classList.remove("hidden");

    // Si el usuario sale de la vista de reconocimiento mientras la cámara sigue encendida,
    // se apaga automáticamente (para no dejarla prendida de fondo sin necesidad)
    if (btn.dataset.view !== "recognition-view" && isCameraActive()) {
      handleStopCamera();
    }
  });
});

// ---------- Catálogo: carga y render de una página ----------
/**
 * Carga una página del catálogo desde la PokéAPI y la renderiza en pantalla.
 * @param {number} page - número de página a cargar (0 = primera página)
 */
async function loadCatalogPage(page) {
  // Se avisa visualmente que se está cargando
  systemStatusEl.textContent = "ONLINE // LOADING...";
  errorEl.classList.add("hidden"); // se oculta cualquier error anterior
  renderSkeletons(cardsContainer, PAGE_SIZE); // se muestran tarjetas "fantasma" mientras carga

  try {
    // offset = cuántos Pokémon saltarse antes de esta página (page 0 -> offset 0, page 1 -> offset 8, etc.)
    const offset = page * PAGE_SIZE;
    // 1. Se pide la lista básica (nombre + url) de esta página
    const basicList = await fetchPokemonList(PAGE_SIZE, offset);
    // 2. Se pide el detalle completo de cada uno de esos Pokémon
    const details = await fetchPokemonDetails(basicList);
    // Se guarda en caché para que la búsqueda local pueda usarla sin volver a pedir a la API
    fullPokemonCache = details;
    // Se dibujan las tarjetas reales en el contenedor
    renderCardsGrid(cardsContainer, details);
    // Se actualiza el indicador de página (ej. "PÁG 02")
    pageIndicator.textContent = `PÁG ${String(page + 1).padStart(2, "0")}`;
    // Se actualiza el contador de resultados encontrados
    matchesFoundEl.textContent = `MATCHES FOUND: ${String(details.length).padStart(3, "0")}`;
    // El botón "anterior" se deshabilita si ya estamos en la primera página
    prevBtn.disabled = page === 0;
    // Se vuelve a mostrar el estado normal del sistema
    systemStatusEl.textContent = "ONLINE // SCANNING";
  } catch (err) {
    // Si algo falla (sin conexión, API caída, etc.), se limpia el catálogo
    // y se muestra el mensaje de error correspondiente
    cardsContainer.innerHTML = "";
    errorEl.classList.remove("hidden");
    errorEl.textContent = `⚠ ${err.message}`;
    systemStatusEl.textContent = "ERROR // API";
  }
}

// Botón "anterior": retrocede una página, siempre que no estemos ya en la primera
prevBtn.addEventListener("click", () => {
  if (currentPage > 0) {
    currentPage--;
    loadCatalogPage(currentPage);
  }
});

// Botón "siguiente": siempre avanza una página más
nextBtn.addEventListener("click", () => {
  currentPage++;
  loadCatalogPage(currentPage);
});

/**
 * Agrega un nombre a la lista de "recientes" (sin duplicados, máximo 5) y la vuelve a pintar.
 * @param {string} name
 */
function addRecent(name) {
  // Si el nombre ya está en la lista, no se agrega de nuevo
  if (recentSearches.includes(name)) return;
  // Se agrega al inicio del arreglo (lo más reciente siempre primero)
  recentSearches.unshift(name);
  // Si ya hay más de 5 elementos, se elimina el más antiguo (el último del arreglo)
  if (recentSearches.length > 5) recentSearches.pop();
  // Se regenera el HTML completo de la lista de recientes en el sidebar
  recentListEl.innerHTML = recentSearches
    .map((n) => `<div class="truncate uppercase">${n}</div>`)
    .join("");
}

// ---------- Búsqueda: primero en cache local, si no está, consulta la API ----------
let searchDebounce; // guarda el identificador del setTimeout, para poder cancelarlo
searchInput.addEventListener("input", () => {
  // "Debounce": cada vez que el usuario escribe una tecla, se cancela el timer anterior
  // y se arranca uno nuevo. Así solo se ejecuta la búsqueda 400ms después de que
  // el usuario dejó de escribir (evita hacer una petición por cada tecla presionada)
  clearTimeout(searchDebounce);
  const query = searchInput.value.trim().toLowerCase();

  searchDebounce = setTimeout(async () => {
    // Si el campo de búsqueda quedó vacío, se vuelve a mostrar la página normal del catálogo
    if (!query) {
      loadCatalogPage(currentPage);
      return;
    }

    // Primero se busca dentro de los Pokémon ya cargados en memoria (sin usar la API)
    const localMatches = fullPokemonCache.filter((p) => p.name.includes(query));
    if (localMatches.length > 0) {
      renderCardsGrid(cardsContainer, localMatches);
      matchesFoundEl.textContent = `MATCHES FOUND: ${String(localMatches.length).padStart(3, "0")}`;
      return;
    }

    // Si no hubo coincidencias locales, se intenta buscar directamente en la PokéAPI
    // (esto solo funciona con el nombre o id EXACTO, no con coincidencias parciales)
    errorEl.classList.add("hidden");
    renderSkeletons(cardsContainer, 1); // se muestra un solo skeleton mientras se busca
    try {
      const detail = await fetchPokemonDetail(query);
      renderCardsGrid(cardsContainer, [detail]);
      matchesFoundEl.textContent = "MATCHES FOUND: 001";
      addRecent(detail.name); // se guarda como búsqueda reciente exitosa
    } catch {
      // Si tampoco se encontró en la API, se muestra el mensaje de "no encontrado"
      cardsContainer.innerHTML = "";
      errorEl.classList.remove("hidden");
      errorEl.textContent = "⚠ No se encontró ningún Pokémon con ese nombre o ID.";
      matchesFoundEl.textContent = "MATCHES FOUND: 000";
    }
  }, 400); // 400 milisegundos de espera antes de ejecutar la búsqueda
});

// ---------- Reconocimiento: control de la cámara ----------

/**
 * Cambia el color del LED indicador de estado de la cámara.
 * @param {string} color - nombre de color de Tailwind (ej. "tertiary-fixed", "error")
 */
function setCameraLed(color) {
  cameraLed.className = `w-3 h-3 rounded-full bg-${color}`;
}

/**
 * Maneja todo el flujo de encender la cámara: pedir permiso, mostrar el video,
 * cargar el modelo de reconocimiento y arrancar el ciclo de predicción.
 */
async function handleStartCamera() {
  // Estado visual mientras se pide permiso al navegador
  cameraMessage.textContent = "Solicitando permiso de cámara...";
  cameraStatusLabel.textContent = "SOLICITANDO PERMISO";
  setCameraLed("secondary-container");

  // Se intenta encender la cámara (camera.js maneja toda la lógica de getUserMedia)
  const result = await startCamera(videoEl);

  if (!result.ok) {
    // Diccionario de mensajes según la razón específica del fallo
    const messages = {
      "no-camera": "No se detectó ninguna cámara en este dispositivo.",
      "permission-denied": "Permiso de cámara denegado por el usuario.",
      unsupported: "Este navegador no soporta acceso a la cámara.",
      error: "Ocurrió un error al intentar acceder a la cámara.",
    };
    // Se muestra el mensaje correspondiente (o uno genérico si la razón no está mapeada)
    cameraMessage.textContent = messages[result.reason] || messages.error;
    cameraStatusLabel.textContent = "CÁMARA NO DISPONIBLE";
    setCameraLed("error");
    return; // se corta la función aquí: no tiene sentido seguir sin cámara
  }

  // Si la cámara se encendió correctamente, se actualiza toda la interfaz:
  videoEl.classList.remove("hidden"); // se muestra el <video>
  cameraMessage.classList.add("hidden"); // se oculta el mensaje de "presiona iniciar"
  focusReticle.classList.remove("hidden"); // se muestra el cuadro de enfoque
  cameraStatusLabel.textContent = "CÁMARA ACTIVA";
  setCameraLed("tertiary-fixed");
  // El botón físico cambia de texto de "SCAN" a "STOP" (es el mismo botón, cambia su función)
  cameraToggleBtn.querySelector("span:last-child").textContent = "STOP";
  recognitionState.textContent = "Cargando modelo de reconocimiento...";

  try {
    // Se carga el modelo de Teachable Machine (puede tardar unos segundos la primera vez)
    await loadRecognitionModel();
    recognitionState.textContent = "Analizando imagen...";
    // Se arranca el ciclo continuo de predicción, indicando qué función llamar en cada caso.
    // handleRecognitionError cubre el estado "Error en el reconocimiento" pedido en la rúbrica.
    startPredictionLoop(videoEl, cameraFrameEl, handleDetected, handleNoneDetected, handleProgress, handleRecognitionError);
  } catch (err) {
    recognitionState.textContent = "⚠ Error al cargar el modelo de reconocimiento.";
  }
}

/**
 * Apaga la cámara y regresa toda la interfaz de reconocimiento a su estado inicial.
 */
function handleStopCamera() {
  stopPredictionLoop(); // detiene el ciclo de predicciones de recognition.js
  stopCamera(videoEl); // apaga físicamente la cámara (camera.js)
  videoEl.classList.add("hidden");
  focusReticle.classList.add("hidden");
  cameraMessage.classList.remove("hidden");
  cameraMessage.textContent = "Presiona INICIAR CÁMARA para comenzar";
  cameraStatusLabel.textContent = "CÁMARA EN ESPERA";
  setCameraLed("outline");
  cameraToggleBtn.querySelector("span:last-child").textContent = "SCAN"; // el botón vuelve a decir "SCAN"
  recognitionState.textContent = "Esperando inicio de cámara...";
  scanResultBox.classList.add("hidden"); // se oculta cualquier resultado anterior
  resultCardContent.innerHTML = ""; // se limpia la tarjeta de resultado
}

// El botón físico de "SCAN/STOP" alterna entre encender y apagar la cámara
// según su estado actual (isCameraActive viene de camera.js)
cameraToggleBtn.addEventListener("click", () => {
  if (isCameraActive()) {
    handleStopCamera();
  } else {
    handleStartCamera();
  }
});

// ---------- Reconocimiento: qué pasa cuando se detecta (o no) un Pokémon ----------

/**
 * Se llama desde recognition.js cuando se confirma un Pokémon con suficiente confianza
 * y suficientes frames consecutivos. Consulta la PokéAPI y muestra su tarjeta de resultado.
 * @param {string} label - nombre del Pokémon detectado (en minúsculas)
 */
async function handleDetected(label) {
  recognitionState.textContent = `Pokémon reconocido: ${label}. Consultando PokéAPI...`;
  try {
    // Se pide el detalle completo del Pokémon detectado a la PokéAPI
    const detail = await fetchPokemonDetail(label.toLowerCase());
    resultCardContent.innerHTML = ""; // se limpia cualquier resultado anterior
    // Se crea la tarjeta con la opción { recognized: true } para que se vea distinta
    // (con el anillo de color y el texto "✔ Reconocido")
    resultCardContent.appendChild(createPokemonCard(detail, { recognized: true }));
    scanResultBox.classList.remove("hidden"); // se muestra el panel de resultado
    recognitionState.textContent = "¡Pokémon reconocido!";
  } catch (err) {
    // Si la PokéAPI falla justo en este momento (poco probable, pero posible)
    recognitionState.textContent = "⚠ Error al consultar la PokéAPI para este Pokémon.";
  }
}

/**
 * Se llama desde recognition.js en cada frame donde no se detecta nada reconocible.
 */
function handleNoneDetected() {
  recognitionState.textContent = "Objeto no reconocido...";
}

/**
 * Se llama desde recognition.js mientras se está acumulando la racha de frames
 * consecutivos, antes de llegar al mínimo requerido para confirmar.
 * @param {string} label
 * @param {number} streak - frames consecutivos acumulados hasta ahora
 * @param {number} required - frames consecutivos necesarios para confirmar
 */
function handleProgress(label, streak, required) {
  recognitionState.textContent = `Confirmando ${label}... (${streak}/${required})`;
}

/**
 * Se llama desde recognition.js si falla la predicción en algún frame
 * (ej. error interno del modelo o del canvas). No detiene la cámara ni el ciclo:
 * solo informa al usuario que hubo un error puntual en ese frame y se sigue intentando.
 * @param {Error} err
 */
function handleRecognitionError(err) {
  recognitionState.textContent = "⚠ Error en el reconocimiento. Reintentando...";
}

// ---------- Inicialización ----------
// Al cargar el script por primera vez, se pide y se muestra la primera página del catálogo
loadCatalogPage(currentPage);
