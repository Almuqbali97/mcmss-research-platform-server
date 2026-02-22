import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-research-platform',
    dbName: process.env.DB_NAME || 'medical-research-platform',
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@medical-research-platform.com',
  },
  app: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    appName: process.env.APP_NAME || 'Research and Studies Committee',
    logoUrl: process.env.EMAIL_LOGO_URL || 'https://mcmss-client.onrender.com/assets/logo-DVgwY-qi.png',
  },
  otp: {
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES, 10) || 15,
    length: parseInt(process.env.OTP_LENGTH, 10) || 6,
  },
};
