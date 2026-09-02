// cards.js
// Genera las tarjetas de Pokémon (catálogo y resultado de reconocimiento)
// reutilizando las clases Tailwind exportadas desde el diseño de Google Stitch.

// Se importa la función que reproduce el sonido, para conectarla al botón de cada tarjeta
import { playCry } from "./audio.js";

// Colores aproximados por tipo de Pokémon (paleta clásica de los juegos)
// Se usan para pintar las "insignias" de tipo (fuego, agua, planta, etc.)
const TYPE_COLORS = {
  normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030",
  grass: "#78C850", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0",
  ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820",
  rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848",
  steel: "#B8B8D0", fairy: "#EE99AC",
};

/**
 * Genera el HTML de una sola insignia (badge) de tipo, con su color correspondiente.
 * @param {string} typeName - nombre del tipo (ej. "fire")
 */
function typeBadge(typeName) {
  // Si el tipo no está en la lista de colores conocidos, se usa un gris por defecto
  const color = TYPE_COLORS[typeName] || "#999999";
  // "33" al final del color de fondo = opacidad baja en hexadecimal (para que se vea suave)
  return `<span class="px-2 py-1 font-label-data text-[10px] rounded uppercase font-bold tracking-wider"
    style="background-color:${color}33;color:${color};">${typeName}</span>`;
}

/**
 * Crea el elemento DOM de una tarjeta de Pokémon (estilo catálogo).
 * @param {object} pokemon - objeto devuelto por fetchPokemonDetail (o marcado con error)
 * @param {object} options - opciones extra, ej. { recognized: true } para la vista de cámara
 */
export function createPokemonCard(pokemon, options = {}) {
  // Se crea un <div> vacío que será el contenedor de toda la tarjeta
  const card = document.createElement("div");
  // Clases base de la tarjeta + un anillo extra ("ring") si fue reconocida por la cámara
  card.className =
    "bg-surface-container rounded-lg p-3 shadow-md flex flex-col gap-3 group hover:-translate-y-1 transition-transform duration-200 relative" +
    (options.recognized ? " ring-2 ring-tertiary" : "");

  // Caso especial: si el Pokémon vino marcado con error o no tiene imagen,
  // se muestra una tarjeta simplificada de "datos no disponibles" y se corta aquí la función
  if (pokemon.error || !pokemon.image) {
    card.innerHTML = `
      <span class="font-label-lcd text-[10px] text-on-surface opacity-60 absolute -top-1 -right-1 bg-surface rounded-full w-8 h-8 flex items-center justify-center shadow-sm z-10">#???</span>
      <div class="bg-surface-container-lowest rounded-md p-2 flex-1 flex items-center justify-center min-h-[140px]">
        <span class="material-symbols-outlined text-surface-variant text-[48px]">pest_control</span>
      </div>
      <h3 class="font-headline-lg text-[16px] text-error uppercase tracking-tight text-center">Datos no disponibles</h3>
    `;
    return card;
  }

  // Número de Pokédex con formato "#001" (relleno con ceros a la izquierda)
  const idLabel = pokemon.id ? `#${String(pokemon.id).padStart(3, "0")}` : "#???";
  // Genera el HTML de todas las insignias de tipo juntas (ej. fuego + volador)
  const typesHtml = (pokemon.types || []).map(typeBadge).join("");
  // Se prefiere el sprite animado (pixel art) si existe; si no, se usa la imagen estática
  const spriteSrc = pokemon.animatedSprite || pokemon.image;
  const isAnimated = Boolean(pokemon.animatedSprite);

  // Se arma todo el contenido visual de la tarjeta con template literals (HTML dentro de JS)
  card.innerHTML = `
    <div class="absolute -top-1 -right-1 w-8 h-8 bg-surface rounded-full flex items-center justify-center shadow-sm z-10">
      <span class="font-label-lcd text-[10px] text-on-surface opacity-60">${idLabel}</span>
    </div>
    <div class="bg-surface-container-lowest rounded-md p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] flex-1 flex items-center justify-center min-h-[100px] max-h-40 relative overflow-hidden">
      <img class="${isAnimated ? "" : "pokemon-sprite"} max-w-full max-h-32 object-contain ${isAnimated ? "" : "mix-blend-multiply"} filter drop-shadow-md group-hover:scale-110 transition-transform duration-300"
        src="${spriteSrc}" alt="${pokemon.name}" loading="lazy"
        style="${isAnimated ? "image-rendering:pixelated;width:96px;height:96px;" : `animation-delay:${(Math.random() * 2).toFixed(2)}s;`}" />
    </div>
    <div class="flex items-center justify-between">
      <h3 class="font-headline-lg text-[20px] text-on-surface font-bold uppercase tracking-tight">${pokemon.name}</h3>
      <button class="sound-btn w-8 h-8 rounded-full bg-secondary-container text-on-secondary shadow-sm flex items-center justify-center hover:bg-secondary transition-colors relative overflow-hidden"
        aria-label="Reproducir sonido de ${pokemon.name}" ${pokemon.cry ? "" : "disabled"}>
        <span class="absolute top-0 left-0 right-0 h-1 bg-white/40"></span>
        <span class="material-symbols-outlined text-[16px]">volume_up</span>
      </button>
    </div>
    ${typesHtml ? `<div class="flex gap-2">${typesHtml}</div>` : ""}
    ${options.recognized ? `<span class="font-label-data text-[10px] text-tertiary uppercase font-bold text-center">✔ Reconocido</span>` : ""}
  `;

  // Una vez insertado el HTML, se busca el botón de sonido recién creado
  const soundBtn = card.querySelector(".sound-btn");
  // Solo se conecta el evento de clic si el Pokémon tiene un cry disponible
  if (pokemon.cry) {
    soundBtn.addEventListener("click", () => playCry(pokemon.cry, soundBtn));
  }

  // Se devuelve el elemento DOM completo, listo para insertarse en la página
  return card;
}

/**
 * Tarjeta de skeleton (carga): mismo tamaño/proporciones que una tarjeta real,
 * pero con bloques grises pulsantes en vez de datos reales.
 */
export function createSkeletonCard() {
  const card = document.createElement("div");
  // "animate-pulse" es la clase de Tailwind que genera el efecto de parpadeo suave
  card.className =
    "bg-surface-container/50 rounded-lg p-3 flex flex-col gap-3 relative opacity-70 animate-pulse";
  card.innerHTML = `
    <div class="absolute -top-1 -right-1 w-8 h-8 bg-surface-container-high rounded-full z-10"></div>
    <div class="bg-surface-container-high rounded-md flex-1 min-h-[140px] flex items-center justify-center">
      <span class="material-symbols-outlined text-surface-variant text-[48px]">catching_pokemon</span>
    </div>
    <div class="flex items-center justify-between">
      <div class="h-6 w-24 bg-surface-container-high rounded"></div>
      <div class="w-8 h-8 rounded-full bg-surface-container-high"></div>
    </div>
  `;
  return card;
}

/**
 * Limpia el contenedor dado y lo llena con una tarjeta real por cada Pokémon de la lista.
 * @param {HTMLElement} container
 * @param {object[]} pokemonList
 */
export function renderCardsGrid(container, pokemonList) {
  container.innerHTML = ""; // Se vacía el contenido anterior (evita duplicados)
  pokemonList.forEach((p) => container.appendChild(createPokemonCard(p)));
}

/**
 * Limpia el contenedor dado y lo llena con "count" tarjetas de skeleton (carga).
 * @param {HTMLElement} container
 * @param {number} count
 */
export function renderSkeletons(container, count = 8) {
  container.innerHTML = "";
  for (let i = 0; i < count; i++) container.appendChild(createSkeletonCard());
}
