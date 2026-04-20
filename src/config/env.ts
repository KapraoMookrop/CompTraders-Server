import dotenv from "dotenv";
import { CLIENT_RENEG_LIMIT } from "tls";

dotenv.config();

export const ENV = {
  PORT: process.env.PORT || "3000",

  DB_HOST: process.env.DB_HOST!,
  DB_PORT: Number(process.env.DB_PORT),
  DB_USER: process.env.DB_USER!,
  DB_PASSWORD: process.env.DB_PASSWORD!,
  DB_NAME: process.env.DB_NAME!,

  JWT_SECRET: process.env.JWT_SECRET!,

  CLIENT_URL: process.env.CLIENT_URL!,
  SOCKET_URL: process.env.SOCKET_URL!,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI!,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN!,
};