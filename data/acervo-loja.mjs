import archive from '../catalogo.js';
import { restoreArchive } from './acervo.mjs';

// Em 24/11/2026 a loja destinou 10.000 unidades a cada variante original do acervo.
export const archiveProducts = restoreArchive(archive, { openingStock: 10_000 });
