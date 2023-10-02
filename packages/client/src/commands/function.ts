import fs from 'fs';
import chalk from 'chalk';
import shell from 'shelljs';
import ts from 'typescript';
import { createOrUpdateServerFunction, createOrUpdateClientFunction, getSpecs } from '../api';
import { loadConfig } from '../config';
import { generateSingleCustomFunction } from './generate';
import { FunctionDetailsDto } from '@poly/model';
import { EXCLUDED_REQUIREMENTS } from '@poly/common/transpiler';

const getDependencies = (code: string) => {
  const importedLibraries = new Set<string>();

  ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      noImplicitUseStrict: true,
    },
    transformers: {
      before: [
        (context) => {
          return (sourceFile) => {
            const visitor = (node: ts.Node): ts.Node => {
              if (ts.isImportDeclaration(node)) {
                const library = node.moduleSpecifier?.getText()
                  .replace(/'/g, '')
                  .replace(/"/g, '');
                if (library && !library.startsWith('.')) {
                  importedLibraries.add(library);
                }
              }
              return node;
            };
            return ts.visitEachChild(sourceFile, visitor, context);
          };
        },
      ],
    },
  });

  return Array.from(importedLibraries)
    .filter(library => !EXCLUDED_REQUIREMENTS.includes(library));
};

export const addOrUpdateCustomFunction = async (
  context: string | null,
  name: string,
  description: string | null,
  file: string,
  server: boolean | undefined,
) => {
  loadConfig();

  try {
    let customFunction: FunctionDetailsDto;

    const specs = await getSpecs([context], [name]);
    const functionSpec = specs.find(spec => spec.name === name && spec.context === context);
    const updating = !!functionSpec;
    if (server === undefined && updating) {
      server = functionSpec.type === 'serverFunction';
    } else {
      server = server ?? false;
    }

    const code = fs.readFileSync(file, 'utf8');

    if (server) {
      shell.echo('-n', chalk.rgb(255, 255, 255)(`${updating ? 'Updating' : 'Adding'} custom server side function...`));

      if (getDependencies(code).length) {
        shell.echo(chalk.yellow('Please note that deploying your functions will take a few minutes because it makes use of libraries other than polyapi.'));
      }

      customFunction = await createOrUpdateServerFunction(context, name, description, code);
      shell.echo(chalk.green('DEPLOYED'));

      shell.echo(chalk.rgb(255, 255, 255)(`Function ID: ${customFunction.id}`));
    } else {
      shell.echo('-n', chalk.rgb(255, 255, 255)(`${updating ? 'Updating' : 'Adding'} custom client side function...`));
      customFunction = await createOrUpdateClientFunction(context, name, description, code);
      shell.echo(chalk.green('DONE'));
      shell.echo(chalk.rgb(255, 255, 255)(`Function ID: ${customFunction.id}`));
    }

    await generateSingleCustomFunction(customFunction.id, updating);
  } catch (e) {
    shell.echo(chalk.red('ERROR\n'));
    shell.echo(`${e.response?.data?.message || e.message}`);
  }
};
