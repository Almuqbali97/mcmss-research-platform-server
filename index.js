import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import connectDB from './config/db.js';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { notFound, globalErrorHandler } from './middlewares/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Medical Research Platform API', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Medical Research Platform API',
    endpoints: { auth: '/api/auth', submissions: '/api/submissions', publicationFunding: '/api/publication-funding', reviewers: '/api/reviewers' },
  });
});

app.use('/api', routes);

app.use(notFound);
app.use(globalErrorHandler);

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
