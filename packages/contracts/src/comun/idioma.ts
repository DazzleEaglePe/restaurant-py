import { z } from 'zod';

// Mensajes de validación en español (docs/09_DESIGN_SYSTEM.md §16). Se configura
// aquí, donde se crean los esquemas: la API (CommonJS) y este paquete (ESM) cargan
// copias distintas de zod, y la configuración vale solo para la copia que la recibe.
z.config(z.locales.es());
