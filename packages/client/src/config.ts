import fs from 'fs';
import dotenv from 'dotenv';
import { POLY_USER_FOLDER_NAME } from './constants';

const POLY_USER_FOLDER_PATH = `${__dirname}/../../../../${POLY_USER_FOLDER_NAME}`;
const POLY_CONFIG_FILE_PATH = `${POLY_USER_FOLDER_PATH}/.config.env`;

export const loadConfig = () => {
  if (fs.existsSync(POLY_CONFIG_FILE_PATH)) {
    dotenv.config({ path: POLY_CONFIG_FILE_PATH });
  }
};

export const saveConfig = (config: Record<string, string>) => {
  fs.mkdirSync(POLY_USER_FOLDER_PATH, { recursive: true });
  fs.writeFileSync(
    POLY_CONFIG_FILE_PATH,
    Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
};
