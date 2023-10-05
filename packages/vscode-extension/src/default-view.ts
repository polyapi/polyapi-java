import * as childProcess from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import fs from 'fs';
import { getClientPackageJson, getCredentialsFromExtension, getLibraryVersionFromApiHost, getPackageManager, getWorkspacePath, saveCredentialsInExtension, saveCredentialsOnClientLibrary } from './common';
import { MESSAGES, checkLibraryVersions, checkNodeVersion, checkTsConfig, getUpdateLibraryVersionMessage } from '@poly/common/client-dependencies';

const exec = promisify(childProcess.exec);

const URL_REGEX = /https?:\/\/(?:w{1,3}\.)?[^\s.]+(?:\.[a-z]+)*(?::\d+)?(?![^<]*(?:<\/\w+>|\/?>))/;

export default class DefaultView {
  async setupLibraryCredentials() {
    const credentials = getCredentialsFromExtension();

    if (credentials.apiBaseUrl && credentials.apiKey) {
      return saveCredentialsOnClientLibrary(credentials.apiBaseUrl, credentials.apiKey);
    }

    const apiBaseUrl = await vscode.window.showInputBox({
      title: 'Credentials',
      prompt: 'Set your api base url.',
      validateInput(value) {
        if (!URL_REGEX.test(value)) {
          return {
            message: 'Given URL is not valid. Please enter valid URL.',
            severity: vscode.InputBoxValidationSeverity.Error,
          };
        }
        return null;
      },
      value: (credentials.apiBaseUrl as string) || 'https://na1.polyapi.io',
    });

    const apiKey = await vscode.window.showInputBox({
      title: 'Credentials',
      prompt: 'Set your api key.',
      validateInput(value) {
        if (!value.trim().length) {
          return {
            message: 'You must provide an api key.',
            severity: vscode.InputBoxValidationSeverity.Error,
          };
        }
        return null;
      },
      value: (credentials.apiKey as string),
    });

    if (apiBaseUrl && apiKey) {
      saveCredentialsInExtension(apiBaseUrl, apiKey);
      saveCredentialsOnClientLibrary(apiBaseUrl, apiKey);
      vscode.commands.executeCommand('setContext', 'missingCredentials', false);
    } else {
      throw new Error('Missing credentials.');
    }
  }

  async setupLibrary() {
    let invalidNodeVersion = false;

    checkNodeVersion({
      onOldVersion(message) {
        invalidNodeVersion = true;
        vscode.window.showErrorMessage(message);
      },
    });

    if (invalidNodeVersion) {
      return;
    }

    try {
      await this.setupLibraryCredentials();
    } catch (err) {
      return vscode.window.showErrorMessage('Failed to set poly credentials.');
    }

    try {
      await this.installLibrary();
      vscode.window.showInformationMessage('Poly library installed.');
    } catch (err) {
      return vscode.window.showErrorMessage('Failed to install polyapi');
    }

    try {
      await this.checkDependencies();
    } catch (err) {
      console.log(err);
      vscode.window.showErrorMessage('Failed checking dependencies.');
    }

    try {
      await this.requestPolyGenerateExecution();
      vscode.window.showInformationMessage('Generated poly client code.');
    } catch (err) {
      vscode.window.showErrorMessage('Failed to generate poly client code.');
    }
  }

  private installLibrary() {
    return new Promise((resolve, reject) => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing poly library',
        cancellable: false,
      }, async () => {
        vscode.commands.executeCommand('setContext', 'installingPolyLibrary', true);
        const packageManager = getPackageManager();
        const credentials = getCredentialsFromExtension();

        const libraryVersion = getLibraryVersionFromApiHost(credentials.apiBaseUrl);
        const libraryFullName = `polyapi${libraryVersion ? `@${libraryVersion}` : ''}`;

        let installCommand = `npm install ${libraryFullName}`;

        if (packageManager === 'yarn') {
          installCommand = `yarn add ${libraryFullName}`;
        }

        try {
          const workSpacePath = getWorkspacePath();
          if (!workSpacePath) {
            throw new Error('Path not found');
          }

          await exec(`cd ${workSpacePath} && ${installCommand}`);

          resolve(true);
        } catch (err) {
          reject(err);
        }
        vscode.commands.executeCommand('setContext', 'installingPolyLibrary', false);
      });
    });
  }

  private requestPolyGenerateExecution() {
    return new Promise((resolve, reject) => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating poly functions.',
        cancellable: false,
      }, async () => {
        try {
          const workSpacePath = getWorkspacePath();
          if (!workSpacePath) {
            throw new Error('Path not found');
          }

          await exec(`cd ${workSpacePath} && npx poly generate`);

          resolve(true);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private async checkDependencies() {
    const packageJsonContents = getClientPackageJson();

    await checkLibraryVersions(JSON.parse(packageJsonContents), {
      async requestUserPermissionToUpdateLib(library, version, minVersion) {
        const answer = await vscode.window.showQuickPick(['Yes', 'No'], {
          title: getUpdateLibraryVersionMessage(version, minVersion, library), canPickMany: false,
        });

        return answer === 'Yes';
      },
      async createOrUpdateLib(library, create) {
        return new Promise((resolve) => {
          vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${create ? 'Installing' : 'Updating'} ${library}...`,
          }, async () => {
            try {
              const workSpacePath = getWorkspacePath();
              if (!workSpacePath) {
                throw new Error('Path not found');
              }

              await exec(`cd ${workSpacePath} && ${getPackageManager()} add ${library}@latest`);
              resolve(undefined);
            } catch (err) {
              console.log(err);
              vscode.window.showErrorMessage(`Couldn't ${create ? 'create' : 'update '} ${library}.`);
              resolve(undefined);
            }
          });
        });
      },
    });

    await checkTsConfig({
      async getCurrentConfig() {
        const tsConfigPath = `${getWorkspacePath()}/tsconfig.json`;
        if (!fs.existsSync(tsConfigPath)) {
          return undefined;
        }

        return fs.readFileSync(tsConfigPath, 'utf-8');
      },
      async requestUserPermissionToCreateTsConfig() {
        const answer = await vscode.window.showQuickPick(['Yes', 'No'], {
          title: MESSAGES.TS_CONFIG_DO_NOT_EXIST, canPickMany: false,
        });

        return answer === 'Yes';
      },
      async requestUserPermissionToUpdateTsConfig() {
        const answer = await vscode.window.showQuickPick(['Yes', 'No'], {
          title: MESSAGES.TS_CONFIG_UPDATE, canPickMany: false,
        });

        return answer === 'Yes';
      },
      async saveTsConfig(tsConfig) {
        fs.writeFileSync(`${getWorkspacePath()}/tsconfig.json`, tsConfig);
      },
    });
  }
}
