import shell from 'shelljs';
import inquirer from 'inquirer';
import { loadConfig, saveConfig } from '../config';

const URL_REGEX = /https?:\/\/(?:w{1,3}\.)?[^\s.]+(?:\.[a-z]+)*(?::\d+)?(?![^<]*(?:<\/\w+>|\/?>))/;

const setup = async () => {
  loadConfig();

  await shell.echo('Please setup your connection to Poly service.');

  const { polyApiBaseUrl, polyApiKey } = await inquirer.prompt([
    {
      type: 'input',
      name: 'polyApiBaseUrl',
      message: 'Poly API Base URL:',
      default: process.env.POLY_API_BASE_URL || 'https://na1.polyapi.io',
      filter: (value) => value.trim(),
      validate: (url) => {
        if (!URL_REGEX.test(url)) {
          return 'Given URL is not valid. Please enter valid URL.';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'polyApiKey',
      message: 'Poly App Key or User Key:',
      default: process.env.POLY_API_KEY,
      filter: (value) => value.trim(),
    },
  ]);

  saveConfig({
    POLY_API_BASE_URL: polyApiBaseUrl,
    POLY_API_KEY: polyApiKey,
  });
};

export default setup;
