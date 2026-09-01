# 🐾 Pokédex Web con Reconocimiento Visual (IA)

**Estudiantes:** Bonilla Navarrete Andre Mike y Rangel Rocha Oscar Adrián  
**Asignación:** Pokédex Web con consumo de API e Inteligencia Artificial  
**Tecnología Asignada:** JavaScript sin frameworks (Vanilla JS)  
**Diseño de Interfaz:** [Enlace a Google Stitch o captura del prototipo]

---

## 📌 Descripción del Proyecto

Esta aplicación web consiste en una Pokédex interactiva que consume información en tiempo real desde la [PokéAPI](https://pokeapi.co/). Presenta un catálogo interactivo mediante tarjetas que incluyen nombres, imágenes y sonidos/cries de cada Pokémon.

Además, cuenta con un **módulo avanzado de reconocimiento de imágenes en vivo** mediante la cámara web, capaz de detectar objetos o tarjetas de Pokémon específicos y realizar la consulta automática a la API.

---

## 🚀 Características Principales

### Básico
- **Catálogo Dinámico:** Consulta y renderizado de Pokémon en tarjetas independientes.
- **Reproducción de Sonido:** Botón interactivo para escuchar el *cry* oficial de cada Pokémon (sin autoreproducción).
- **Diseño Adaptable (Responsive):** Interfaz amigable para pantallas de escritorio y móviles.
- **Gestión de Estados:** Indicadores visuales para estados de *Carga*, *Éxito* y *Error*.

### Avanzado (Reconocimiento Visual)
- **Navegación Vista Dual:** Alternancia limpia entre la Pokédex visual y el escáner con cámara.
- **Acceso a Cámara Web:** Integración con la API de MediaDevices para capturar la cámara en tiempo real.
- **Reconocimiento con IA:** Detección en vivo mediante modelo de visión artificial.
- **Flujo Automático:** Consulta inmediata a la PokéAPI tras el reconocimiento exitoso del Pokémon.

---

## 🛠️ Tecnologías y Herramientas Utilizadas

- **Lenguaje:** HTML5, CSS3, JavaScript Pure/Vanilla (ES6 Modules).
- **Consumo de API:** PokéAPI (`https://pokeapi.co/api/v2/`).
- **Visión Artificial:** [Especificar: Teachable Machine / TensorFlow.js / ml5.js].
- **Herramientas de Inteligencia Artificial:**
  - **Google Stitch:** Prototipado y diseño inicial de la interfaz.
  - **Gemini / ChatGPT:** Asistencia en la estructuración de llamadas asíncronas (`async/await`), optimización de manejo del DOM y resolución de errores.

---

## 📸 Pokémon Reconocibles (Nivel Avanzado)

El modelo de visión artificial fue preparado para reconocer los siguientes 3 Pokémones:

1. **[Pikachu]** (ID: `25`)
2. **[Charmander]** (ID: `4`)
3. **[Bulbasaur]** (ID: `1`)

---

## 📦 Instrucciones de Instalación y Ejecución

Por requerimiento técnico, la aplicación **debe ser ejecutada a través de un servidor local** (no abrir directamente mediante `file://`).

### Opción a: Con Live Server (Visual Studio Code)
1. Clona o descarga este repositorio.
2. Abre la carpeta del proyecto en **Visual Studio Code**.
3. Instala la extensión **Live Server**.
4. Haz clic derecho sobre el archivo `index.html` y selecciona **"Open with Live Server"**.
5. Se abrirá automáticamente la aplicación en tu navegador en `http://127.0.0.1:5500`.

### Opción b: Con Node.js / `http-server`
1. Abre tu terminal en la carpeta raíz del proyecto.
2. Ejecuta el servidor estático:
   ```bash
   npx http-server .
