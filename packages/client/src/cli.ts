#!/usr/bin/env node
/* tslint:disable:no-shadowed-variable */
import yargs from 'yargs';
import shell from 'shelljs';
import setup from './commands/setup';
import { generate } from './commands/generate';
import { addOrUpdateCustomFunction } from './commands/function';
import { loadConfig } from './config';
import { create as createTenant } from './commands/tenant';

const checkPolyConfig = () => {
  loadConfig();

  if (!process.env.POLY_API_KEY) {
    return false;
  }

  return true;
};

void yargs
  .usage('$0 <cmd> [args]')
  .command('setup', 'Setups your Poly connection', setup)
  .command(
    'generate [options]',
    'Generates Poly library',
    {
      contexts: {
        describe: 'Contexts to generate',
        demandOption: false,
        type: 'string',
      },
      names: {
        describe: 'Names to generate',
        demandOption: false,
        type: 'string',
      },
      functionIds: {
        describe: 'Function IDs to generate',
        demandOption: false,
        type: 'string',
      },
    },
    async ({ exitWhenNoConfig, contexts, names, functionIds }) => {
      if (!checkPolyConfig()) {
        if (exitWhenNoConfig) {
          shell.echo('Poly is not configured. Please run `poly generate` manually.');
          return;
        }

        await setup();
      }

      await generate(contexts?.split(','), names?.split(','), functionIds?.split(','));
    },
  )
  .command('function <command>', 'Manages functions', (yargs) => {
    yargs.command(
      'add <name> <file> [options]',
      'Adds a custom function',
      (yargs) =>
        yargs
          .usage('$0 function add <name> <file> [options]')
          .default('context', '')
          .positional('name', {
            describe: 'Name of the function',
            type: 'string',
          })
          .positional('file', {
            describe: 'Path to the function TS file',
            type: 'string',
          })
          .option('context', {
            describe: 'Context of the function',
            type: 'string',
          })
          .option('description', {
            describe: 'Description of the function',
            type: 'string',
          })
          .option('server', {
            describe: 'Marks the function as a server function',
            type: 'boolean',
          }),
      async ({ name, description, file, context, server }) => {
        if (!name || !file) {
          yargs.showHelp();
          return;
        }

        await addOrUpdateCustomFunction(context, name, description, file, server);
      },
    );
  })
  .command('tenant <command>', 'Manages tenants', (yargs) => {
    yargs.command(
      'create [options]',
      'Creates a new tenant',
      {
        instance: {
          describe: 'Instance where you want to create tenant (develop | na1 | local)',
          demandOption: false,
          type: 'string',
        },
      },
      async ({
        instance = 'na1',
      }) => {
        await createTenant(instance);
      },
    );
  })
  .help(true).argv;
