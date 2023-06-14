import * as vscode from 'vscode';
import { ProviderResult, TreeItem } from 'vscode';
import { PropertySpecification, PropertyType } from '@poly/common';
import { toCamelCase } from '@guanghechen/helper-string';

// duplicate from packages/client/src/commands/generate.ts
// find a way how to extract it to common package
const toTypeDeclaration = (type: PropertyType, synchronous = true) => {
  const wrapInPromiseIfNeeded = (code: string) => (synchronous ? code : `Promise<${code}>`);

  switch (type.kind) {
    case 'plain':
      return type.value;
    case 'primitive':
      return wrapInPromiseIfNeeded(type.type);
    case 'void':
      return wrapInPromiseIfNeeded('void');
    case 'array':
      return wrapInPromiseIfNeeded(`${toTypeDeclaration(type.items)}[]`);
    case 'object':
      if (type.typeName) {
        return wrapInPromiseIfNeeded(type.typeName);
      } else if (type.properties) {
        return wrapInPromiseIfNeeded(
          `{ ${type.properties
            .map((prop) => `${prop.name}${prop.required === false ? '?' : ''}: ${toTypeDeclaration(prop.type)}`)
            .join(';\n')} }`,
        );
      } else {
        return wrapInPromiseIfNeeded('any');
      }
    case 'function':
      if (type.name) {
        return type.name;
      }
      const toArgument = (arg: PropertySpecification) =>
        `${arg.name}${arg.required === false ? '?' : ''}: ${toTypeDeclaration(arg.type)}${
          arg.nullable === true ? ' | null' : ''
        }`;

      return `(${type.spec.arguments.map(toArgument).join(', ')}) => ${toTypeDeclaration(
        type.spec.returnType,
        type.spec.synchronous === true,
      )}`;
  }
};

class LibraryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly parentPath: string,
    public readonly data: any,
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.generateTooltip();
  }

  private generateTooltip() {
    const { type, name, description, visibilityMetadata } = this.data;

    const getTooltipBase = (title: string) => {
      return `**${title}**\n\n` +
        `${visibilityMetadata?.foreignTenantName
          ? `Tenant: ${visibilityMetadata?.foreignTenantName}\n\n---\n\n`
          : '---\n\n'}` +
        `${description ? `${description}\n\n---\n\n` : ''}`;
    };

    const getFunctionTooltip = (title: string) => {
      const toFunctionArgument = (arg: PropertySpecification) => {
        return `${toCamelCase(arg.name)}${arg.required === false ? '?' : ''}: ${toTypeDeclaration(arg.type)}`;
      };

      return new vscode.MarkdownString(
        getTooltipBase(title) +
        `${name}(${this.data.function.arguments.map(toFunctionArgument).join(', ')})`,
      );
    };

    switch (type) {
      case 'apiFunction':
        this.tooltip = getFunctionTooltip('API function');
        break;
      case 'customFunction':
        this.tooltip = getFunctionTooltip('Custom function');
        break;
      case 'serverFunction':
        this.tooltip = getFunctionTooltip('Server function');
        break;
      case 'authFunction':
        this.tooltip = getFunctionTooltip('OAuth function');
        break;
      case 'webhookHandle':
        this.tooltip = new vscode.MarkdownString(
          getTooltipBase('Webhook listener') + `${name}()`,
        );
        break;
      default:
        this.tooltip = new vscode.MarkdownString(
          `**Context**\n\n---\n\n${this.label}`,
        );
        break;
    }
  }
}

export default class LibraryIndexViewProvider implements vscode.TreeDataProvider<LibraryTreeItem> {
  private specs: Record<string, any> = {};

  private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

  getChildren(parent?: LibraryTreeItem): ProviderResult<LibraryTreeItem[]> {
    const data = parent?.data || this.specs;
    if (data.type) {
      return [];
    }

    const parentPath = parent ? `${parent.parentPath}.${parent.label}` : 'poly';
    return Object.keys(data)
      .map(key => {
        const collapsibleState = data[key].type
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Collapsed;

        return new LibraryTreeItem(parentPath, data[key], key, collapsibleState);
      })
      .sort((a, b) => {
        if (a.data.type && !b.data.type) {
          return 1;
        } else if (b.data.type && !a.data.type) {
          return -1;
        }
        return a.label.localeCompare(b.label);
      });
  }

  getTreeItem(element: LibraryTreeItem): TreeItem | Thenable<TreeItem> {
    element.command = {
      title: 'Copy to clipboard',
      command: 'poly.copyLibraryItem',
      arguments: [element],
    };
    return element;
  }

  public refresh(specs: Record<string, any>) {
    console.log('POLY: Refreshing index tree data...', specs);
    this.specs = specs;
    this._onDidChangeTreeData.fire();
  }

  static copyLibraryItem(item: LibraryTreeItem) {
    const { parentPath, data, label } = item;
    const { type, name } = data;

    const toArgumentName = arg => `${toCamelCase(arg.name)}`;

    switch (type) {
      case 'apiFunction':
      case 'customFunction':
      case 'serverFunction':
        const args = data.function.arguments;
        vscode.env.clipboard.writeText(
          `await ${parentPath}.${name}(${args.map(toArgumentName).join(', ')});`,
        );
        break;
      case 'authFunction':
        switch (name) {
          case 'getToken':
            vscode.env.clipboard.writeText(`${parentPath}.${name}(${data.function.arguments.slice(0, -2).map(toArgumentName).join(', ')}, (token, url, error) => {\n\n});`);
            break;
          case 'revokeToken':
          case 'introspectToken':
            vscode.env.clipboard.writeText(`await ${parentPath}.${name}(token);`);
            break;
        }
        break;
      case 'webhookHandle':
        vscode.env.clipboard.writeText(`${parentPath}.${name}(event => {\n\n});`);
        break;
      default:
        vscode.env.clipboard.writeText(`${parentPath}.${label}`);
        break;
    }
    vscode.window.showInformationMessage('Copied');
  }
}
