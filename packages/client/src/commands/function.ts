import fs from 'fs';
import chalk from 'chalk';
import shell from 'shelljs';
import { createServerFunction, createClientFunction } from '../api';
import { loadConfig } from '../config';
import { generateSingleCustomFunction } from './generate';
import { FunctionDetailsDto } from '@poly/model';

export const addCustomFunction = async (
  context: string | null,
  name: string,
  description: string | null,
  file: string,
  server: boolean,
) => {
  loadConfig();

  try {
    let customFunction: FunctionDetailsDto;

    const code = fs.readFileSync(file, 'utf8');
    if (server) {
      shell.echo('-n', chalk.rgb(255, 255, 255)(`Adding custom server side function...`));
      customFunction = await createServerFunction(context, name, description, code);
    } else {
      shell.echo('-n', chalk.rgb(255, 255, 255)(`Adding custom client side function...`));
      customFunction = await createClientFunction(context, name, description, code);
    }
    shell.echo(chalk.green('DONE'));

    await generateSingleCustomFunction(customFunction.id);
  } catch (e) {
    shell.echo(chalk.red('ERROR\n'));
    shell.echo(`${e.response?.data?.message || e.message}`);
  }
};
