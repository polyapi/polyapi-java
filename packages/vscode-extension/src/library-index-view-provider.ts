import * as vscode from 'vscode';
import * as path from 'path';
import { ProviderResult, TreeItem } from 'vscode';
import { merge } from 'lodash';
import { PropertySpecification, VariableSpecification } from '@poly/model';
import { toTypeDeclaration } from '@poly/common/specs';
import { toCamelCase } from '@guanghechen/helper-string';
import { getCredentialsFromExtension, getLibraryVersionFromApiHost } from './common';

type TreeState = Record<string, { state: vscode.TreeItemCollapsibleState }>

class LibraryTreeItem extends vscode.TreeItem {
  constructor(
    private context: vscode.ExtensionContext,
    public readonly parentPath: string,
    public readonly data: any,
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.resourceUri = vscode.Uri.parse(`poly://type/${data.type || 'context'}`);
    this.iconPath = this.getIconPath();
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

    const toVariableDeclaration = ({ valueType }: VariableSpecification) => {
      return `${toTypeDeclaration(valueType)}\n\n`;
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
      case 'serverVariable':
        this.id = `serverVariable.${this.parentPath}.${name}`;
        this.contextValue = 'serverVariable';
        this.tooltip = new vscode.MarkdownString(
          getTooltipBase('Server variable') +
          `${this.data.variable.secret ? 'Variable is secret.\n\n' : ''}` +
          `${name}: ${toVariableDeclaration(this.data.variable)}`,
        );
        break;
      default:
        this.tooltip = new vscode.MarkdownString(
          `**Context**\n\n---\n\n${this.label}`,
        );
        break;
    }
  }

  private getIconPath() {
    const { type, visibilityMetadata } = this.data;
    if (!type) {
      return undefined;
    }

    switch (visibilityMetadata?.visibility) {
      case 'PUBLIC':
        return vscode.Uri.file(
          path.join(this.context.extensionPath, 'resources', 'icon-public.svg'),
        );
      default:
        return 'none';
    }
  }
}

export default class LibraryIndexViewProvider implements vscode.TreeDataProvider<LibraryTreeItem> {
  private specs: Record<string, any> = {};

  private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

  readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {
  }

  getChildren(parent?: LibraryTreeItem): ProviderResult<LibraryTreeItem[]> {
    const prevTreeState = this.context.globalState.get<TreeState | undefined>(LibraryIndexViewProvider.getTreeStateKey());

    const data = parent?.data || this.specs;
    if (data.type) {
      return [];
    }

    const parentPath = parent ? `${parent.parentPath}.${parent.label}` : '';

    return Object.keys(data)
      .map(key => {
        let collapsibleState = data[key].type
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Collapsed;

        const path = `${parentPath}${key ? `.${key}` : ''}`;

        if (prevTreeState && prevTreeState[path]?.state) {
          collapsibleState = prevTreeState[path].state;
        }

        return new LibraryTreeItem(this.context, parentPath, data[key], key, collapsibleState);
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

  getTreeItem(element: LibraryTreeItem): TreeItem {
    element.command = {
      title: 'Copy to clipboard',
      command: 'poly.copyLibraryItem',
      arguments: [element],
    };
    element.contextValue = element.data.type;
    return element;
  }

  public refresh(specs: Record<string, any>) {
    console.log('POLY: Refreshing index tree data...', specs);
    this.specs = specs;
    this._onDidChangeTreeData.fire();
  }

  static copyLibraryItem(item: LibraryTreeItem, opts: {
    variGet: boolean
  } = {
    variGet: false,
  }) {
    const { parentPath, data, label } = item;
    const { type, name } = data;

    const toArgumentName = arg => `${toCamelCase(arg.name)}`;

    switch (type) {
      case 'apiFunction':
      case 'customFunction':
      case 'serverFunction': {
        const args = data.function.arguments;
        vscode.env.clipboard.writeText(
          `await poly${parentPath}.${name}(${args.map(toArgumentName).join(', ')});`,
        );
        break;
      }
      case 'authFunction':
        switch (name) {
          case 'getToken':
            vscode.env.clipboard.writeText(`poly${parentPath}.${name}(${data.function.arguments.slice(0, -2).map(toArgumentName).join(', ')}, (token, url, error) => {\n\n});`);
            break;
          case 'revokeToken':
          case 'introspectToken':
            vscode.env.clipboard.writeText(`await poly${parentPath}.${name}(token);`);
            break;
        }
        break;
      case 'webhookHandle':
        vscode.env.clipboard.writeText(`poly${parentPath}.${name}(async(event, headers, params) => {\n\n});`);
        break;
      case 'serverVariable':
        vscode.env.clipboard.writeText(`${opts.variGet ? 'await ' : ''}vari${parentPath}.${name}.${opts.variGet ? 'get' : 'inject'}()`);
        break;
      default:
        vscode.env.clipboard.writeText(`poly${parentPath}.${label}`);
        break;
    }
    vscode.window.showInformationMessage('Copied');
  }

  static getTreeStateKey() {
    const credentials = getCredentialsFromExtension();

    const tag = getLibraryVersionFromApiHost(credentials.apiBaseUrl);

    return `tree-state-${tag ? `${tag}-` : ''}${credentials.apiKey}`;
  }

  saveElementState(element: vscode.TreeViewExpansionEvent<LibraryTreeItem>['element'], state: vscode.TreeItemCollapsibleState) {
    const TREE_STATE_KEY = LibraryIndexViewProvider.getTreeStateKey();

    const prevTreeState = this.context.globalState.get<TreeState>(TREE_STATE_KEY);

    const path = `${element.parentPath}.${element.label}`;

    if (state === vscode.TreeItemCollapsibleState.Collapsed) {
      if (typeof prevTreeState !== 'undefined') {
        delete prevTreeState[path];
      }
      return this.context.globalState.update(TREE_STATE_KEY, prevTreeState);
    }

    const newTreeState = merge(prevTreeState, {
      [path]: {
        state,
      },
    } as TreeState);

    return this.context.globalState.update(TREE_STATE_KEY, merge(prevTreeState, newTreeState));
  }

  register() {
    const TREE_ID = 'poly.library-index-view';

    const tree = vscode.window.createTreeView(TREE_ID, {
      treeDataProvider: this,
    });

    tree.onDidCollapseElement(event => {
      const { element } = event;

      this.saveElementState(element, vscode.TreeItemCollapsibleState.Collapsed);
    });

    tree.onDidExpandElement(event => {
      const { element } = event;

      this.saveElementState(element, vscode.TreeItemCollapsibleState.Expanded);
    });

    this.context.subscriptions.push(tree);
  }
}
