// api.js
// Responsable único de toda la comunicación con la PokéAPI.
// Ningún otro archivo debe hacer fetch() directo a pokeapi.co; todos pasan por aquí.

// URL base de la PokéAPI (v2). Todas las peticiones se arman a partir de esta constante.
const BASE_URL = "https://pokeapi.co/api/v2";

/**
 * Obtiene una lista paginada de Pokémon (solo nombre y url, sin detalle todavía).
 * @param {number} limit  - cuántos Pokémon pedir por página
 * @param {number} offset - desde qué posición empezar (para paginar)
 */
export async function fetchPokemonList(limit = 12, offset = 0) {
  // Arma la URL de la lista con los parámetros de paginación limit/offset
  const response = await fetch(`${BASE_URL}/pokemon?limit=${limit}&offset=${offset}`);
  // Si la respuesta no fue exitosa (status fuera del rango 200-299), se lanza un error
  // con un mensaje descriptivo que main.js podrá mostrar al usuario.
  if (!response.ok) {
    throw new Error(`Error al obtener la lista de Pokémon (status ${response.status})`);
  }
  // Convierte el cuerpo de la respuesta de JSON a un objeto de JavaScript
  const data = await response.json();
  // La PokéAPI devuelve { count, next, previous, results }; solo nos interesa "results"
  return data.results; // [{ name, url }]
}

/**
 * Obtiene el detalle completo de un Pokémon por nombre o id.
 * Extrae únicamente lo que la app necesita: nombre, imagen, sprite animado, sonido y tipos.
 * @param {string|number} nameOrId
 */
export async function fetchPokemonDetail(nameOrId) {
  // Petición al endpoint de detalle: acepta tanto nombre ("pikachu") como id numérico (25)
  const response = await fetch(`${BASE_URL}/pokemon/${nameOrId}`);
  // Si el Pokémon no existe o hay un error de red/servidor, se lanza un error específico
  if (!response.ok) {
    throw new Error(`Pokémon "${nameOrId}" no encontrado (status ${response.status})`);
  }
  // Cuerpo de la respuesta ya parseado como objeto JS
  const data = await response.json();

  // Imagen principal: se prioriza el "official artwork" (más grande y de mejor calidad).
  // Si no existe, se usa el sprite normal de frente. Si tampoco existe, queda en null.
  const image =
    data.sprites?.other?.["official-artwork"]?.front_default ||
    data.sprites?.front_default ||
    null;

  // Sprite animado (pixel art en movimiento) de la generación V, estilo blanco y negro.
  // No todos los Pokémon lo tienen, por eso puede quedar en null.
  const animatedSprite =
    data.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default ||
    null;

  // Sonido (cry) del Pokémon: se prefiere la versión "latest"; si no existe, se usa "legacy"
  const cry = data.cries?.latest || data.cries?.legacy || null;

  // Los tipos vienen como un arreglo de objetos { type: { name, url } }; nos quedamos
  // solo con el nombre de cada tipo (ej. "fire", "water")
  const types = (data.types || []).map((t) => t.type.name);

  // Se devuelve un objeto "limpio" con solo los datos que usa el resto de la app
  return {
    id: data.id,
    name: data.name,
    image,
    animatedSprite,
    cry,
    types,
  };
}

/**
 * Dado un array de {name, url} (resultado de fetchPokemonList), obtiene el detalle de cada uno.
 * Cada fetch se maneja de forma independiente para que un fallo
 * individual no rompa el resto de la lista.
 */
export async function fetchPokemonDetails(basicList) {
  // Promise.all ejecuta todas las peticiones en paralelo (más rápido que una por una)
  const results = await Promise.all(
    basicList.map(async (p) => {
      try {
        // Se pide el detalle completo usando solo el nombre básico
        return await fetchPokemonDetail(p.name);
      } catch (err) {
        // Si este Pokémon en particular falla, no se detiene todo el proceso:
        // se devuelve un objeto marcado como "error" para que la tarjeta lo muestre así
        return { id: null, name: p.name, image: null, cry: null, error: true };
      }
    })
  );
  // Se devuelve el arreglo completo de detalles (algunos exitosos, otros marcados con error)
  return results;
}
