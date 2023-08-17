import * as vscode from 'vscode';
import axios from 'axios';
import { RawAxiosRequestHeaders } from 'axios/index';
import EventSource from 'eventsource';
import { getCredentialsFromExtension } from './common';

const PER_PAGE = 5;

export default class ChatViewProvider implements vscode.WebviewViewProvider {
  private webView?: vscode.WebviewView;
  private cancelRequest?: () => void;
  private requestAbortController;
  private conversationHistoryFullyLoaded = false;
  private firstMessagesLoaded = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
  ) {
  }

  private async getConversationHistory(firstMessageDate = '') {
    const {
      apiBaseUrl,
      apiKey,
    } = getCredentialsFromExtension();

    if (!apiBaseUrl || !apiKey) {
      return;
    }

    try {
      this.webView?.webview.postMessage({
        type: 'setLoading',
        value: {
          cancellable: false,
          prepend: true,
          skipScrollToLastMessage: true,
        },
      });

      const firstMessageDateQueryParam = firstMessageDate ? `&firstMessageDate=${firstMessageDate}` : '';

      const { data } = await axios.get(`${apiBaseUrl}/chat/history?perPage=${PER_PAGE}${firstMessageDateQueryParam}`, {
        headers: {
          authorization: `Bearer ${apiKey}`,
        } as RawAxiosRequestHeaders,
      });

      this.webView?.webview.postMessage({
        type: 'prependConversationHistory',
        value: {
          messages: data,
          firstLoad: !this.firstMessagesLoaded,
        },
      });

      if (!data.length) {
        this.conversationHistoryFullyLoaded = true;
      }

      if (!this.firstMessagesLoaded) {
        this.firstMessagesLoaded = true;
      }
    } catch (error) {
      this.webView?.webview.postMessage({
        type: 'prependConversationHistory',
        value: {
          type: 'error',
        },
      });
    }
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
          this.cancelRequest?.();
          break;
        }
        case 'goToExtensionSettings': {
          this.goToExtensionSettings();
          break;
        }
        case 'getMoreConversationMessages': {
          if (!this.conversationHistoryFullyLoaded) {
            this.getConversationHistory(data.value);
          }
          break;
        }
      }
    });

    webviewView.onDidChangeVisibility(async () => {
      const visible = webviewView.visible;
      if (visible && !this.firstMessagesLoaded) {
        await this.getConversationHistory();
      }
    });

    if (!this.firstMessagesLoaded) {
      this.getConversationHistory();
    }
  }

  private async sendPolyQuestionRequest(message: string) {
    const {
      apiBaseUrl,
      apiKey,
    } = getCredentialsFromExtension();

    if (!apiBaseUrl || !apiKey) {
      vscode.window.showErrorMessage('Please set the API base URL and API key in the extension settings.', 'Go to settings').then(selection => {
        if (selection === 'Go to settings') {
          this.goToExtensionSettings();
        }
      });
      return;
    }
    this.cancelRequest?.();

    const messageID = Math.random().toString(36).substring(7);

    this.webView?.webview.postMessage({
      type: 'addQuestion',
      value: message,
    });
    this.webView?.webview.postMessage({
      type: 'setLoading',
    });
    let loadingPresent = true;

    const removeLoading = () => {
      this.webView?.webview.postMessage({
        type: 'removeLoading',
      });
      loadingPresent = false;
    };

    let uuid = '';

    try {
      const response = await axios.post<{ uuid: string }>(`${apiBaseUrl}/chat/store-message`, {
        message,
      }, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      uuid = response.data.uuid;
    } catch (error) {
      this.webView?.webview.postMessage({
        type: 'addMessage',
        data: {
          type: 'error',
          value: error.data,
        },
      });
      return removeLoading();
    }

    const es = new EventSource(`${apiBaseUrl}/chat/question?message_uuid=${uuid}`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    });

    this.cancelRequest = () => {
      es.close();
      removeLoading();
    };

    let answer = '';
    es.onmessage = (event) => {
      if (loadingPresent) {
        removeLoading();
      }

      answer += event.data;

      this.webView?.webview.postMessage({
        type: 'updateMessage',
        data: {
          type: 'markdown',
          value: answer + (answer.match(/```/g)?.length % 2 === 1 ? '\n```' : ''),
        },
        messageID,
      });
    };

    es.onerror = (error) => {
      removeLoading();
      if (error.data) {
        console.error(error);
        this.webView?.webview.postMessage({
          type: 'addMessage',
          data: {
            type: 'error',
            value: error.data,
          },
        });
      } else if (error.message) {
        console.error(error);
        this.webView?.webview.postMessage({
          type: 'addMessage',
          data: {
            type: 'error',
            value: error.message,
            error,
          },
        });
      } else {
        this.webView?.webview.postMessage({
          type: 'finishMessage',
          messageID,
        });
      }
      es.close();
    };
  }

  private async sendPolyCommandRequest(command: string) {
    const apiBaseUrl = vscode.workspace.getConfiguration('poly').get('apiBaseUrl');
    const apiKey = vscode.workspace.getConfiguration('poly').get('apiKey');

    if (!apiBaseUrl || !apiKey) {
      vscode.window.showErrorMessage('Please set the API base URL and API key in the extension settings.');
      return;
    }

    switch (command) {
      case 'c':
      case 'clear':
        this.webView?.webview.postMessage({
          type: 'clearConversation',
        });
        break;
      default:
        break;
    }

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
    const htmlEscaper = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'html-escaper.min.js'));

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
        <script src='${htmlEscaper}'></script>
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
