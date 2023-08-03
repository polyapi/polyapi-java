import { FunctionArgument } from '@poly/model';
import ts, { EnumDeclaration, factory, InterfaceDeclaration } from 'typescript';
import * as TJS from 'typescript-json-schema';
import os from 'os';
import path from 'path';
import util from 'util';
import fs from 'fs';
import crypto from 'crypto';
import { omit } from 'lodash';

const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

export interface TranspileResult {
  code: string;
  args: FunctionArgument[];
  returnType: string;
  synchronous: boolean;
  contextChain: string[];
  requirements: string[];
}

// NodeJS built-in libraries + polyapi
// https://www.w3schools.com/nodejs/ref_modules.asp
const EXCLUDED_REQUIREMENTS = [
  'polyapi',
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'https',
  'net',
  'os',
  'path',
  'process',
  'punycode',
  'querystring',
  'readline',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'zlib',
];

export const transpileCode = async (functionName: string, code: string): Promise<TranspileResult> => {
  let functionArguments: FunctionArgument[] | null = null;
  let returnType: string | null = null;
  let synchronous = true;
  const contextChain: string[] = [];
  const importedLibraries = new Set<string>();
  const interfaceDeclarations: Record<string, InterfaceDeclaration> = {};
  const enumDeclarations: Record<string, EnumDeclaration> = {};
  const classDeclarations: Record<string, ts.ClassDeclaration> = {};

  const result = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      noImplicitUseStrict: true,
    },
    fileName: 'customFunction.ts',
    transformers: {
      before: [
        (context) => {
          return (sourceFile) => {
            let fnDeclaration: ts.MethodDeclaration | ts.FunctionDeclaration | null = null;

            const visitor = (node: ts.Node): ts.Node => {
              if (returnType !== null) {
                return node;
              }

              if (ts.isInterfaceDeclaration(node)) {
                interfaceDeclarations[node.name.text] = node;
              }
              if (ts.isEnumDeclaration(node)) {
                enumDeclarations[node.name.text] = node;
              }
              if (ts.isClassDeclaration(node) && node.name) {
                classDeclarations[node.name.text] = node;
              }

              if (ts.isImportDeclaration(node)) {
                const library = node.moduleSpecifier?.getText()
                  .replace(/'/g, '')
                  .replace(/"/g, '');
                if (library && !library.startsWith('.')) {
                  importedLibraries.add(library);
                }
              }

              // process `const library = require('library');`
              if (ts.isVariableStatement(node)) {
                const declaration = node.declarationList.declarations[0];
                if (declaration.initializer &&
                  ts.isCallExpression(declaration.initializer) &&
                  declaration.initializer.expression.getText() === 'require') {
                  const library = declaration.initializer.arguments[0].getText()
                    .replace(/'/g, '')
                    .replace(/"/g, '');
                  if (library && !library.startsWith('.')) {
                    importedLibraries.add(library);
                  }
                }
              }

              if (ts.isExportAssignment(node)) {
                const result = ts.visitEachChild(node, visitor, context);

                if (fnDeclaration) {
                  return fnDeclaration;
                }
                return result;
              }

              if (ts.isObjectLiteralExpression(node)) {
                return ts.visitEachChild(node, visitor, context);
              }

              if (ts.isPropertyAssignment(node)) {
                contextChain.push(node.name.getText());

                const result = ts.visitEachChild(node, visitor, context);

                if (!fnDeclaration) {
                  contextChain.pop();
                }

                return result;
              }

              if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                if (node.name?.getText() === functionName) {
                  functionArguments = node.parameters.map((param) => ({
                    key: param.name.getText(),
                    name: param.name.getText(),
                    type: param.type?.getText() || 'any',
                    ...(param.questionToken ? { required: false } : {}),
                  })) as FunctionArgument[];

                  returnType = node.type?.getText() || 'any';

                  if (ts.isMethodDeclaration(node)) {
                    fnDeclaration = factory.createFunctionDeclaration(
                      [],
                      node.asteriskToken,
                      node.name?.getText(),
                      node.typeParameters,
                      node.parameters,
                      node.type,
                      node.body,
                    );
                  } else {
                    fnDeclaration = node;
                  }
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

  if (!functionArguments) {
    throw new Error(`Function ${functionName} not found.`);
  } else {
    functionArguments = functionArguments as FunctionArgument[];
  }
  if (!returnType) {
    throw new Error(`Return type not specified. Please add return type explicitly to function ${functionName}.`);
  } else {
    returnType = returnType as string;
  }

  if (returnType.startsWith('Promise')) {
    synchronous = false;
    returnType = returnType.replace('Promise<', '').replace('>', '');
  }

  const typeSchemas = await getJSONSchemas(interfaceDeclarations, enumDeclarations, classDeclarations);

  const returnTypeSchema = typeSchemas[returnType.replace('[]', '')];
  if (returnTypeSchema) {
    returnType = returnType.endsWith('[]') ? wrapIntoArraySchema(returnTypeSchema) : returnTypeSchema;
  }
  functionArguments.forEach((arg) => {
    const argTypeSchema = typeSchemas[arg.type.replace('[]', '')];
    if (argTypeSchema) {
      arg.typeSchema = arg.type.endsWith('[]') ? wrapIntoArraySchema(argTypeSchema) : argTypeSchema;
    }
  });

  return {
    code: result.outputText,
    args: functionArguments,
    returnType,
    synchronous,
    contextChain,
    requirements: Array.from(importedLibraries)
      .filter(library => !EXCLUDED_REQUIREMENTS.includes(library)),
  };
};

const getJSONSchemas = async (interfaceDeclarations: Record<string, ts.InterfaceDeclaration>, enumDeclarations: Record<string, ts.EnumDeclaration>, classDeclarations: Record<string, ts.ClassDeclaration>): Promise<Record<string, string>> => {
  if (Object.keys(interfaceDeclarations).length === 0 && Object.keys(enumDeclarations).length === 0 && Object.keys(classDeclarations).length === 0) {
    return {};
  }

  const schemas: Record<string, string> = {};

  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `${crypto.randomBytes(16).toString('hex')}.ts`);

  await writeFile(
    tempFilePath,
    [
      ...Object.values(interfaceDeclarations).map((declaration) => {
        return declaration.getText();
      }),
      ...Object.values(enumDeclarations).map((declaration) => {
        return declaration.getText();
      }),
      ...Object.values(classDeclarations).map((declaration) => {
        return declaration.getText();
      }),
    ]
      .join('\n'),
    'utf8',
  );

  const program = ts.createProgram([tempFilePath], {});

  for (const name in interfaceDeclarations) {
    if (interfaceDeclarations.hasOwnProperty(name)) {
      const schema = TJS.generateSchema(program, name, { required: true, noExtraProps: true });
      if (schema) {
        schemas[name] = JSON.stringify(schema);
      }
    }
  }
  for (const name in enumDeclarations) {
    if (enumDeclarations.hasOwnProperty(name)) {
      const schema = TJS.generateSchema(program, name, { required: true, noExtraProps: true });
      if (schema) {
        schemas[name] = JSON.stringify(schema);
      }
    }
  }
  for (const name in classDeclarations) {
    if (classDeclarations.hasOwnProperty(name)) {
      const schema = TJS.generateSchema(program, name, { required: true, noExtraProps: true });
      if (schema) {
        schemas[name] = JSON.stringify(schema);
      }
    }
  }

  await unlink(tempFilePath);

  return schemas;
};

const wrapIntoArraySchema = (schemaString: string): string => {
  const schema = JSON.parse(schemaString);
  return JSON.stringify({
    type: 'array',
    items: omit(schema, '$schema', 'definitions'),
    definitions: schema.definitions,
  });
};
