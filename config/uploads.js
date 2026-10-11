import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Set UPLOADS_DIR to a persistent volume in deployments with ephemeral application disks.
export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : fileURLToPath(new URL('../uploads/', import.meta.url));
