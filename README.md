# NANA — sitio web estático

NANA es una aplicación web estática hecha con HTML, CSS y JavaScript vanilla. No requiere Node.js, instalación de dependencias ni una base de datos.

## Archivos
- `index.html`: estructura y vistas del sitio.
- `style.css`: estilos adaptables a móvil, tableta y escritorio.
- `script.js`: checklist, objetos personalizados, salidas, listas sugeridas, dictado y chatbot local.

## Probar en tu computadora
Abre `index.html` en un navegador moderno. La mayoría de funciones deberían funcionar directamente. Para probar reconocimiento de voz, el navegador puede exigir HTTPS o un contexto seguro; en GitHub Pages se sirve mediante HTTPS.

## Publicar con GitHub Pages
1. Entra a GitHub y crea un repositorio nuevo, por ejemplo `nana`.
2. Sube `index.html`, `style.css`, `script.js` y este `README.md` a la raíz del repositorio.
3. Abre **Settings → Pages**.
4. En **Build and deployment**, elige **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/ (root)`, y pulsa **Save**.
6. Espera a que GitHub Pages publique el sitio y abre la URL que aparece en esa misma sección.

## Datos y privacidad
- Los datos se guardan en `localStorage` del navegador y dispositivo actual. No se sincronizan automáticamente con otros dispositivos.
- Borrar los datos del sitio en el navegador puede borrar la información guardada. Las fotografías se reducen antes de guardarse, pero el almacenamiento del navegador sigue teniendo límites.
- El chatbot ofrece recomendaciones locales predefinidas; no está conectado a un servicio de IA.
- El reconocimiento de voz usa la API del navegador cuando existe. Si no está disponible, se puede escribir la lista o utilizar el dictado del teclado.

## Integración futura con IA
Para conectar un proveedor real, crea un backend seguro que guarde la clave privada como variable de entorno y exponga un endpoint propio. El frontend debe llamar a ese endpoint, nunca incluir la clave privada en `script.js` ni en el repositorio público. El sitio básico no necesita ese backend.
