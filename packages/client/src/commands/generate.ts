import fs from 'fs';
import handlebars from 'handlebars';
import set from 'lodash/set';
import chalk from 'chalk';
import shell from 'shelljs';
import { toCamelCase, toPascalCase } from '@guanghechen/helper-string';
import prettier from 'prettier';
import { compile } from 'json-schema-to-typescript';
import { v4 as uuidv4 } from 'uuid';

import {
  ApiFunctionSpecification,
  AuthFunctionSpecification,
  CustomFunctionSpecification,
  FunctionPropertyType,
  ObjectPropertyType,
  PropertySpecification,
  ServerFunctionSpecification,
  Specification,
  WebhookHandleSpecification,
} from '@poly/model';
import {
  toTypeDeclaration,
} from '@poly/common/utils';
import { getSpecs } from '../api';
import { POLY_USER_FOLDER_NAME } from '../constants';
import { loadConfig } from '../config';

const POLY_LIB_PATH = `${__dirname}/../../../../../${POLY_USER_FOLDER_NAME}/lib`;

interface Context {
  name: string;
  path: string;
  interfaceName: string;
  fileName?: string;
  level?: number;
}

const getApiBaseUrl = () => process.env.POLY_API_BASE_URL || 'http://localhost:8000';

const getApiKey = () => process.env.POLY_API_KEY;

const prepareDir = () => {
  fs.rmSync(POLY_LIB_PATH, { recursive: true, force: true });
  fs.mkdirSync(POLY_LIB_PATH, { recursive: true });
  fs.mkdirSync(`${POLY_LIB_PATH}/api`);
  fs.mkdirSync(`${POLY_LIB_PATH}/client`);
  fs.mkdirSync(`${POLY_LIB_PATH}/auth`);
  fs.mkdirSync(`${POLY_LIB_PATH}/webhooks`);
  fs.mkdirSync(`${POLY_LIB_PATH}/server`);
};

const loadTemplate = async (fileName: string) => fs.readFileSync(`${__dirname}/../templates/${fileName}`, 'utf8');

const generateJSFiles = async (specs: Specification[]) => {
  const apiFunctions = specs.filter((spec) => spec.type === 'apiFunction') as ApiFunctionSpecification[];
  const customFunctions = specs.filter((spec) => spec.type === 'customFunction') as CustomFunctionSpecification[];
  const webhookHandles = specs.filter((spec) => spec.type === 'webhookHandle') as WebhookHandleSpecification[];
  const authFunctions = specs.filter((spec) => spec.type === 'authFunction') as AuthFunctionSpecification[];
  const serverFunctions = specs.filter((spec) => spec.type === 'serverFunction') as ServerFunctionSpecification[];

  await generateIndexJSFile();
  await generateAxiosJSFile();
  await generateApiFunctionJSFiles(apiFunctions);
  await generateCustomFunctionJSFiles(customFunctions);
  await generateWebhooksJSFiles(webhookHandles);
  await generateAuthFunctionJSFiles(authFunctions);
  await generateServerFunctionJSFiles(serverFunctions);
};

const generateIndexJSFile = async () => {
  const indexJSTemplate = handlebars.compile(await loadTemplate('index.js.hbs'));
  fs.writeFileSync(
    `${POLY_LIB_PATH}/index.js`,
    indexJSTemplate({
      clientID: uuidv4(),
      apiBaseUrl: getApiBaseUrl(),
      apiKey: getApiKey(),
    }),
  );
};

const generateAxiosJSFile = async () => {
  const axiosJSTemplate = handlebars.compile(await loadTemplate('axios.js.hbs'));
  fs.writeFileSync(
    `${POLY_LIB_PATH}/axios.js`,
    axiosJSTemplate({
      apiBaseUrl: getApiBaseUrl(),
      apiKey: getApiKey(),
    }),
  );
};

const generateApiFunctionJSFiles = async (specifications: ApiFunctionSpecification[]) => {
  const template = handlebars.compile(await loadTemplate('api-index.js.hbs'));
  fs.writeFileSync(
    `${POLY_LIB_PATH}/api/index.js`,
    template({
      specifications,
      apiBaseUrl: getApiBaseUrl(),
      apiKey: getApiKey(),
    }),
  );
};

const generateCustomFunctionJSFiles = async (specifications: CustomFunctionSpecification[]) => {
  const customIndexJSTemplate = handlebars.compile(await loadTemplate('custom-index.js.hbs'));
  fs.writeFileSync(
    `${POLY_LIB_PATH}/client/index.js`,
    customIndexJSTemplate({
      specifications,
    }),
  );

  if (specifications.length === 0) {
    return;
  }
  const customFunctionJSTemplate = handlebars.compile(await loadTemplate('custom-function.js.hbs'));
  specifications.forEach((spec) => {
    fs.writeFileSync(
      `${POLY_LIB_PATH}/client/${spec.context ? `${spec.context}-` : ''}${spec.name}.js`,
      prettyPrint(customFunctionJSTemplate(spec), 'babel'),
    );
  });
};

const generateWebhooksJSFiles = async (specifications: WebhookHandleSpecification[]) => {
  const template = handlebars.compile(await loadTemplate('webhooks-index.js.hbs'));
  fs.writeFileSync(
    `${POLY_LIB_PATH}/webhooks/index.js`,
    template({
      specifications,
      apiBaseUrl: getApiBaseUrl(),
      apiKey: getApiKey(),
    }),
  );
};

const generateServerFunctionJSFiles = async (specifications: ServerFunctionSpecification[]) => {
  const serverIndexJSTemplate = handlebars.compile(await loadTemplate('server-index.js.hbs'));
  fs.writeFileSync(
    `${POLY_LIB_PATH}/server/index.js`,
    serverIndexJSTemplate({
      specifications,
      apiBaseUrl: getApiBaseUrl(),
      apiKey: getApiKey(),
    }),
  );
};

const generateAuthFunctionJSFiles = async (specifications: AuthFunctionSpecification[]) => {
  const authIndexJSTemplate = handlebars.compile(await loadTemplate('auth-index.js.hbs'));
  fs.writeFileSync(
    `${POLY_LIB_PATH}/auth/index.js`,
    authIndexJSTemplate({
      getTokenFunctions: specifications.filter((spec) => spec.name === 'getToken'),
      subResourceFunctions: specifications.filter((spec) => spec.subResource),
      apiBaseUrl: getApiBaseUrl(),
      apiKey: getApiKey(),
    }),
  );

  if (specifications.length === 0) {
    return;
  }
  const authFunctionJSTemplate = handlebars.compile(await loadTemplate('auth-function.js.hbs'));
  specifications
    .filter((spec) => !spec.subResource)
    .forEach((spec) => {
      fs.writeFileSync(
        `${POLY_LIB_PATH}/auth/${spec.context ? `${spec.context}-` : ''}${spec.name}.js`,
        prettyPrint(
          authFunctionJSTemplate({
            ...spec,
            audienceRequired: spec.function.arguments.some((arg) => arg.name === 'audience'),
            apiBaseUrl: getApiBaseUrl(),
            apiKey: getApiKey(),
          }),
          'babel',
        ),
      );
    });
};

const generateTSDeclarationFilesForContext = async (
  context: Context,
  contextData: Record<string, any>,
  contextCollector: Context[] = [],
) => {
  const contextDataKeys = Object.keys(contextData);
  const contextDataSpecifications = contextDataKeys
    .map((key) => contextData[key])
    .filter((value) => typeof value.type === 'string') as Specification[];
  const contextDataSubContexts = contextDataKeys
    .filter((key) => !contextData[key].type)
    .map((key) => {
      const path = `${context.path ? `${context.path}.` : ''}${key}`;
      return {
        name: key,
        path,
        fileName: `${path}.d.ts`,
        interfaceName: toPascalCase(path),
        level: context.level + 1,
      };
    });

  await generateTSContextDeclarationFile(context, contextDataSpecifications, contextDataSubContexts);
  contextCollector = [...contextCollector, context];

  for await (const subContext of contextDataSubContexts) {
    contextCollector = await generateTSDeclarationFilesForContext(
      subContext,
      contextData[subContext.name],
      contextCollector,
    );
  }

  return contextCollector;
};

const generateTSDeclarationFiles = async (specs: Specification[]) => {
  const contextData = getContextData(specs);
  const contexts = await generateTSDeclarationFilesForContext(
    {
      name: '',
      path: '',
      interfaceName: 'Poly',
      fileName: 'default.d.ts',
      level: 0,
    },
    contextData,
  );

  await generateTSIndexDeclarationFile(contexts);
};

const generateTSIndexDeclarationFile = async (contexts: Context[]) => {
  const template = handlebars.compile(await loadTemplate('index.d.ts.hbs'));
  fs.writeFileSync(
    `${POLY_LIB_PATH}/index.d.ts`,
    prettyPrint(
      template({
        contexts: contexts.map((context) => ({
          ...context,
          firstLevel: context.level === 1,
        })),
      }),
    ),
  );
};

const schemaToDeclarations = async (namespace: string, typeName: string, schema: Record<string, any>) => {
  const wrapToNamespace = (code: string) => `namespace ${namespace} {\n  ${code}\n}`;

  schema.title = typeName;
  const result = await compile(schema, typeName, {
    format: false,
    bannerComment: '',
  });
  return wrapToNamespace(result);
};

const getReturnTypeDeclarations = async (
  namespace: string,
  objectProperty: ObjectPropertyType,
  typeName = 'ReturnType',
): Promise<string> => {
  const declarations = await schemaToDeclarations(namespace, typeName, objectProperty.schema);
  objectProperty.typeName = `${namespace}.ReturnType`;
  return declarations;
};

const getArgumentsTypeDeclarations = async (
  parentType: string,
  properties: PropertySpecification[],
  typeName = 'Argument',
) => {
  const typeDeclarations: string[] = [];
  const objectProperties = properties.filter((property) => property.type.kind === 'object');
  const functionProperties = properties.filter((property) => property.type.kind === 'function');

  for (const property of objectProperties) {
    const objectProperty = property.type as ObjectPropertyType;
    if (objectProperty.schema) {
      const namespace = `${parentType}$${toPascalCase(property.name)}`;
      objectProperty.typeName = `${namespace}.${typeName}`;

      typeDeclarations.push(await schemaToDeclarations(namespace, typeName, objectProperty.schema));
    } else if (objectProperty.properties) {
      typeDeclarations.push(
        ...(await getArgumentsTypeDeclarations(
          `${parentType}$${toPascalCase(property.name)}`,
          objectProperty.properties,
        )),
      );
    }
  }

  for (const property of functionProperties) {
    const functionProperty = property.type as FunctionPropertyType;
    if (functionProperty.name) {
      // predefined type name
      continue;
    }

    typeDeclarations.push(
      ...(await getArgumentsTypeDeclarations(
        `${parentType}$${toPascalCase(property.name)}`,
        functionProperty.spec.arguments.filter((arg) => arg.type.kind === 'object'),
      )),
    );
    if (functionProperty.spec.returnType.kind === 'object' && functionProperty.spec.returnType.schema) {
      typeDeclarations.push(
        await getReturnTypeDeclarations(
          `${parentType}$${toPascalCase(property.name)}`,
          functionProperty.spec.returnType as ObjectPropertyType,
        ),
      );
    }
  }

  return typeDeclarations;
};

const getSpecificationsTypeDeclarations = async (specifications: Specification[]): Promise<string> => {
  const argumentsTypeDeclarations = (
    await Promise.all(
      specifications.map((spec) => getArgumentsTypeDeclarations(toPascalCase(spec.name), spec.function.arguments)),
    )
  ).flat();
  const returnTypeDeclarations = await Promise.all(
    specifications
      .filter((spec) => spec.function.returnType.kind === 'object' && spec.function.returnType.schema)
      .map((spec) =>
        getReturnTypeDeclarations(toPascalCase(spec.name), spec.function.returnType as ObjectPropertyType),
      ),
  );

  return [...argumentsTypeDeclarations, ...returnTypeDeclarations].join('\n');
};

const generateTSContextDeclarationFile = async (
  context: Context,
  specifications: Specification[],
  subContexts: Context[],
) => {
  const template = handlebars.compile(await loadTemplate('{{context}}.d.ts.hbs'));
  const typeDeclarations = await getSpecificationsTypeDeclarations(specifications);

  const toFunctionDeclaration = (specification: Specification) => {
    const toArgumentDeclaration = (arg: PropertySpecification) => ({
      name: toCamelCase(arg.name),
      required: arg.required,
      type: toTypeDeclaration(arg.type),
    });

    return {
      name: specification.name.split('.').pop(),
      comment: getSpecificationComment(specification),
      arguments: specification.function.arguments.map(toArgumentDeclaration),
      returnType: toTypeDeclaration(specification.function.returnType),
      synchronous: specification.function.synchronous === true,
    };
  };

  fs.writeFileSync(
    `${POLY_LIB_PATH}/${context.fileName}`,
    prettyPrint(
      template({
        interfaceName: context.interfaceName,
        typeDeclarations,
        functionDeclarations: specifications.map(toFunctionDeclaration),
        subContexts,
      }),
    ),
  );
};

const generateContextDataFile = (contextData: Record<string, any>) => {
  fs.writeFileSync(`${POLY_LIB_PATH}/specs.json`, JSON.stringify(contextData, null, 2));
};

const getContextDataFileContent = () => {
  const contents = fs.readFileSync(`${POLY_LIB_PATH}/specs.json`, 'utf-8');

  try {
    return JSON.parse(contents) as Record<string, any>;
  } catch (err) {
    return {};
  }
};

const getContextData = (specs: Specification[]) => {
  const contextData = {} as Record<string, any>;
  specs.forEach((spec) => {
    const path = spec.context ? `${spec.context}.${spec.name}` : spec.name;
    set(contextData, path, spec);
  });
  return contextData;
};

const getSpecsFromContextData = (contextData) => {
  const specs: Specification[] = [];

  const traverseAndGetSpec = (data) => {
    for (const key of Object.keys(data)) {
      if (typeof data[key].context === 'string') {
        specs.push(data[key]);
      } else {
        traverseAndGetSpec(data[key]);
      }
    }
  };

  traverseAndGetSpec(contextData);

  return specs;
};

const prettyPrint = (code: string, parser = 'typescript') =>
  prettier.format(code, {
    parser,
    singleQuote: true,
    printWidth: 160,
  });

const showErrGettingSpecs = (error: any) => {
  shell.echo(chalk.red('ERROR'));
  shell.echo('Error while getting data from Poly server. Make sure the version of library/server is up to date.');
  shell.echo(chalk.red(error.message), chalk.red(JSON.stringify(error.response?.data)));
};

const showErrGeneratingFiles = (error: any) => {
  shell.echo(chalk.red('ERROR'));
  shell.echo('Error while generating code files. Make sure the version of library/server is up to date.');
  shell.echo(chalk.red(error.message));
  shell.echo(chalk.red(error.stack));
};

const generateSingleCustomFunction = async (functionId: string) => {
  shell.echo('-n', chalk.rgb(255, 255, 255)(`Generating new custom function...`));

  let contextData: Record<string, any> = {};

  try {
    contextData = getContextDataFileContent();
  } catch (error) {
    shell.echo(chalk.red('ERROR'));
    shell.echo('Error while fetching local context data.');
    shell.echo(chalk.red(error.message));
    shell.echo(chalk.red(error.stack));
    return;
  }

  const prevSpecs = getSpecsFromContextData(contextData);

  let specs: Specification[] = [];

  try {
    specs = await getSpecs([], [], [functionId]);
  } catch (error) {
    showErrGettingSpecs(error);
    return;
  }

  const [customFunction] = specs;

  if (prevSpecs.some((prevSpec) => prevSpec.id === customFunction.id)) {
    specs = prevSpecs.map((prevSpec) => {
      if (prevSpec.id === customFunction.id) {
        return customFunction;
      }
      return prevSpec;
    });
  } else {
    prevSpecs.push(customFunction);
    specs = prevSpecs;
  }

  await generateSpecs(specs);

  shell.echo(chalk.green('DONE'));
};

const getSpecificationComment = (specification: Specification) => {
  switch (specification.type) {
    case 'customFunction':
      if (!specification.requirements.length) {
        return null;
      }
      return `This function requires you to have the following libraries installed:\n- ${specification.requirements.join(
        '\n- ',
      )}`;
    default:
      return null;
  }
};

const generate = async (contexts?: string[], names?: string[], functionIds?: string[]) => {
  let specs: Specification[] = [];

  shell.echo('-n', chalk.rgb(255, 255, 255)(`Generating Poly functions...`));

  prepareDir();
  loadConfig();

  try {
    specs = await getSpecs(contexts, names, functionIds);
  } catch (error) {
    showErrGettingSpecs(error);
    return;
  }

  await generateSpecs(specs);

  shell.echo(chalk.green('DONE'));
};

const generateSpecs = async (specs: Specification[]) => {
  try {
    await generateJSFiles(specs);
    await generateTSDeclarationFiles(specs);
    generateContextDataFile(getContextData(specs));
  } catch (error) {
    showErrGeneratingFiles(error);
    return;
  }
};

export { generate, generateSingleCustomFunction };
