import * as vscode from 'vscode';
import axios from 'axios';
import { RawAxiosRequestHeaders } from 'axios/index';

export default class ChatViewProvider implements vscode.WebviewViewProvider {
  private webView?: vscode.WebviewView;
  private requestAbortController;

  constructor(
    private readonly context: vscode.ExtensionContext,
  ) {
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
  ) {
    this.webView = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getWebviewHtml(webviewView.webview);

    const {
      apiBaseUrl,
      apiKey,
    } = this.getCredentials();

    if (!apiBaseUrl || !apiKey) {
      this.webView?.webview.postMessage({
        type: 'addSetupMessage',
      });
    }

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'sendCommand': {
          void this.sendPolyCommandRequest(data.value);
          break;
        }
        case 'sendQuestion': {
          void this.sendPolyQuestionRequest(data.value);
          break;
        }
        case 'cancelRequest': {
          this.requestAbortController?.abort();
          break;
        }
        case 'goToExtensionSettings': {
          this.goToExtensionSettings();
          break;
        }
      }
    });
  }

  private getCredentials() {
    return {
      apiBaseUrl: vscode.workspace.getConfiguration('poly').get('apiBaseUrl'),
      apiKey: vscode.workspace.getConfiguration('poly').get('apiKey'),
    };
  }

  private async sendPolyQuestionRequest(message: string) {
    const {
      apiBaseUrl,
      apiKey,
    } = this.getCredentials();

    if (!apiBaseUrl || !apiKey) {
      vscode.window.showErrorMessage('Please set the API base URL and API key in the extension settings.', 'Go to settings').then(selection => {
        if (selection === 'Go to settings') {
          this.goToExtensionSettings();
        }
      });
      return;
    }

    this.webView?.webview.postMessage({
      type: 'addQuestion',
      value: message,
    });
    this.webView?.webview.postMessage({
      type: 'setLoading',
    });

    this.requestAbortController?.abort();
    this.requestAbortController = new AbortController();
    try {
      const { data } = await axios.post(`${apiBaseUrl}/chat/question`, {
        message,
      }, {
        headers: {
          authorization: `Bearer ${apiKey}`,
        } as RawAxiosRequestHeaders,
        signal: this.requestAbortController.signal,
      });

      this.webView?.webview.postMessage({
        type: 'addResponseTexts',
        value: data.texts,
      });
      this.logStats(data.texts);
    } catch (error) {
      console.error(error);
      this.webView?.webview.postMessage({
        type: 'addResponseTexts',
        value: [
          {
            type: 'error',
            value: error.response?.data?.message || error.message,
          },
        ],
      });
    }
  }

  private logStats(texts) {
    texts.forEach(text => {
      if (text.stats) {
        console.log('%c Poly Debug Stats:', 'background: green; color: black', text.stats);
      }
    });
  }

  private async sendPolyCommandRequest(command: string) {
    const apiBaseUrl = vscode.workspace.getConfiguration('poly').get('apiBaseUrl');
    const apiKey = vscode.workspace.getConfiguration('poly').get('apiKey');

    if (!apiBaseUrl || !apiKey) {
      vscode.window.showErrorMessage('Please set the API base URL and API key in the extension settings.');
      return;
    }

    this.webView?.webview.postMessage({
      type: 'clearConversation',
    });

    try {
      await axios.post(`${apiBaseUrl}/chat/command`, {
        command,
      }, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        } as RawAxiosRequestHeaders,
      });
    } catch (error) {
      console.error(error);
    }
  }

  focusMessageInput() {
    this.webView?.show();
    this.webView?.webview.postMessage({
      type: 'focusMessageInput',
    });
  }

  private goToExtensionSettings() {
    vscode.commands.executeCommand('workbench.action.openSettings', `@ext:${this.context.extension.id}`);
  }

  private getWebviewHtml(webview: vscode.Webview) {
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'main.css'));
    const mainJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'main.js'));
    const tailwindJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'tailwindcss.min.js'));
    const markedJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'marked.min.js'));
    const highlightJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'highlight.min.js'));
    const highlightCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'highlight.min.css'));

    return (
      `<!DOCTYPE html>
      <html lang='en'>
      <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>Poly Chat</title>
        <link href='${styleVSCodeUri}' rel='stylesheet'>
        <link href='${styleMainUri}' rel='stylesheet'>
        <script src='${tailwindJs}'></script>
        <script src='${markedJs}'></script>
        <script src='${highlightJs}'></script>
        <link href='${highlightCss}' rel='stylesheet'>
      </head>
      <body class='overflow-hidden'>
        <div class='flex flex-col h-screen'>
          <div class='flex-1 overflow-y-auto' id='conversation-list' data-vscode-context='{"webviewSection": "conversationList", "preventDefaultContextMenuItems": true}'></div>
          <div class='p-2 flex items-center pb-4'>
            <div class='flex-1 message-input-wrapper'>
              <textarea
                id='message-input'
                type='text'
                placeholder='Ask Poly about APIs and Events...'
                onInput='this.parentNode.dataset.messageValue = this.value'
              ></textarea>
            </div>
            <button id='send-message-button' class='right-6 absolute rounded-lg p-1.5 ml-5'>
              <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24'>
                <path stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10.5 12H5m-.084.291L2.58 19.266c-.184.548-.275.822-.21.99a.5.5 0 0 0 .332.3c.174.05.438-.07.965-.306l16.711-7.52c.515-.232.772-.348.851-.509a.5.5 0 0 0 0-.443c-.08-.16-.336-.276-.85-.508L3.661 3.748c-.525-.237-.788-.355-.962-.307a.5.5 0 0 0-.332.3c-.066.168.025.441.206.988l2.342 7.056a.967.967 0 0 1 .053.19.5.5 0 0 1 0 .127c-.006.049-.022.095-.053.19Z'/>
              </svg>
            </button>
          </div>
        </div>
        <script src='${mainJs}'></script>
      </body>
      </html>`
    );
  }
}
