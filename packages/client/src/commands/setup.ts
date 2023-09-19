import shell from 'shelljs';
import inquirer from 'inquirer';
import fs from 'fs';
import semver from 'semver';
import { loadConfig, saveConfig } from '../config';
import chalk from 'chalk';

const URL_REGEX = /https?:\/\/(?:w{1,3}\.)?[^\s.]+(?:\.[a-z]+)*(?::\d+)?(?![^<]*(?:<\/\w+>|\/?>))/;

const MIN_TS_NODE_VERSION = '5.0.0';
const MIN_TYPESCRIPT_VERSION = '4.0.0';
const MIN_NODE_VERSION = '14.0.0';

const DEFAULT_TS_CONFIG = {
  compilerOptions: {
    esModuleInterop: true,
  },
};

const setup = async () => {
  loadConfig();

  if (!process.env.ENVIRONMENT_SETUP_COMPLETE) {
    await setupEnvironment();
  }

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
    ENVIRONMENT_SETUP_COMPLETE: 'true',
  });
};

const setupEnvironment = async () => {
  loadConfig();

  await checkNodeVersion();

  const packageJson = getPackageJson();
  await checkLibraryVersion(packageJson, 'ts-node', MIN_TS_NODE_VERSION);
  await checkLibraryVersion(packageJson, 'typescript', MIN_TYPESCRIPT_VERSION);

  await checkTsConfig();
};

const checkNodeVersion = async () => {
  if (semver.lt(process.version, MIN_NODE_VERSION)) {
    shell.echo(chalk.red(`Node.js version is too old. The minimum required version is ${MIN_NODE_VERSION}. Please update Node.js to a newer version.`));
    throw new Error('Node.js version is too old.');
  }
};

const getPackageManager = () : 'npm' | 'yarn' => {
  return fs.existsSync(`${process.cwd()}/yarn.lock`) ? 'yarn' : 'npm';
};

const checkLibraryVersion = async (packageJson: Record<string, any>, library: string, minVersion: string) => {
  const version = packageJson.devDependencies?.[library] || packageJson.dependencies?.[library];

  if (!version || semver.lt(version.replace(/[^0-9.]/g, ''), minVersion)) {
    const { updateVersion } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'updateVersion',
        message: version
          ? `${library} version is lower than ${minVersion}. Do you want to update it to the latest version?`
          : `${library} is not installed. Do you want to install it?`,
        default: true,
      },
    ]);
    if (updateVersion) {
      await shell.echo(`Installing ${library}...`);
      await shell.exec(`${getPackageManager()} add ${library}@latest`);
    }
  }
};

const checkTsConfig = async () => {
  if (!fs.existsSync(`${process.cwd()}/tsconfig.json`)) {
    const { createTsConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createTsConfig',
        message: 'tsconfig.json does not exist. Do you want to create it?',
        default: true,
      },
    ]);

    if (createTsConfig) {
      await shell.echo('Creating tsconfig.json...');
      fs.writeFileSync(`${process.cwd()}/tsconfig.json`, JSON.stringify(DEFAULT_TS_CONFIG, null, 2));
    }
  } else {
    const tsConfig = JSON.parse(fs.readFileSync(`${process.cwd()}/tsconfig.json`).toString());
    if (!tsConfig.compilerOptions?.esModuleInterop) {
      const { updateTsConfig } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'updateTsConfig',
          message: 'tsconfig.json does not have esModuleInterop set to true. Do you want to update it?',
          default: true,
        },
      ]);
      if (!updateTsConfig) {
        return;
      }

      tsConfig.compilerOptions = {
        ...tsConfig.compilerOptions,
        esModuleInterop: true,
      };
      fs.writeFileSync(`${process.cwd()}/tsconfig.json`, JSON.stringify(tsConfig, null, 2));
    }
  }
};

const getPackageJson = () => {
  const packageJson = fs.readFileSync(`${process.cwd()}/package.json`);
  return JSON.parse(packageJson.toString());
};

export default setup;
