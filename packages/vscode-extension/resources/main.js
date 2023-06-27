const COMMANDS = ['clear'];

(function() {
  const vscode = acquireVsCodeApi();

  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function(code, _lang) {
      return hljs.highlightAuto(code).value;
    },
    langPrefix: 'hljs language-',
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    smartypants: false,
    xhtml: false,
  });

  const loadingSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='48' viewBox='0 0 132 58'><g fill='currentColor' fill-rule='evenodd'><circle class='dot1' cx='25' cy='30' r='13'/><circle class='dot2' cx='65' cy='30' r='13'/><circle class='dot3' cx='105' cy='30' r='13'/></g></svg>`;
  const userSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none' viewBox='0 0 24 24'><path stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-miterlimit='10' stroke-width='1.5' d='M18 18.86h-.76c-.8 0-1.56.31-2.12.87l-1.71 1.69c-.78.77-2.05.77-2.83 0l-1.71-1.69c-.56-.56-1.33-.87-2.12-.87H6c-1.66 0-3-1.33-3-2.97V4.98c0-1.64 1.34-2.97 3-2.97h12c1.66 0 3 1.33 3 2.97v10.91c0 1.63-1.34 2.97-3 2.97Z'/><path stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M12 10a2.33 2.33 0 1 0 0-4.66A2.33 2.33 0 0 0 12 10Zm4 5.66c0-1.8-1.79-3.26-4-3.26s-4 1.46-4 3.26'/></svg>`;
  const polySvg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 512 512'><path fill='currentColor' d='M160 140.8c14.111 0 25.595 11.482 25.6 25.6 0 14.116-11.483 25.6-25.597 25.6H160c-14.116 0-25.6-11.484-25.6-25.6 0-14.116 11.484-25.6 25.6-25.6z'/><path fill='currentColor' d='M160 70.4c52.934 0 96 43.066 96 96s-43.066 96-96 96-96-43.066-96-96 43.066-96 96-96zm0 153.6c31.761 0 57.6-25.839 57.6-57.6 0-31.761-25.839-57.6-57.6-57.6-31.761 0-57.6 25.839-57.6 57.6 0 31.761 25.839 57.6 57.6 57.6z'/><path fill='currentColor' d='M320 7.282C427.492 17.015 512 107.616 512 217.6v19.2h-78.177c-8.489 59.081-55.543 105.869-114.752 113.953C310.061 437.63 236.421 505.6 147.2 505.6H0V6.4Zm0 304.386c37.56-7.654 67.213-37.308 74.868-74.868H320Zm0-113.268h152.54C463.658 118.428 399.972 54.742 320 45.86ZM38.4 467.2h108.8c74.108 0 134.4-60.292 134.4-134.4v-288H38.4Z'/></svg>`;
  const copySvg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' viewBox='0 0 24 24'><path stroke='currentColor' stroke-linejoin='round' stroke-width='2' d='M15 3c1.886 0 2.828 0 3.414.586C19 4.172 19 5.114 19 7v10c0 1.886 0 2.828-.586 3.414C17.828 21 16.886 21 15 21H9c-1.886 0-2.828 0-3.414-.586C5 19.828 5 18.886 5 17V7c0-1.886 0-2.828.586-3.414C6.172 3 7.114 3 9 3h6Z'/><path stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 3v3a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3'/></svg>`;
  const copyCheckSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' viewBox='0 0 24 24'><path stroke='currentColor' stroke-linejoin='round' stroke-width='2' d='M15 3c1.886 0 2.828 0 3.414.586C19 4.172 19 5.114 19 7v10c0 1.886 0 2.828-.586 3.414C17.828 21 16.886 21 15 21H9c-1.886 0-2.828 0-3.414-.586C5 19.828 5 18.886 5 17V7c0-1.886 0-2.828.586-3.414C6.172 3 7.114 3 9 3h6Z'/><path stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 3v3a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3M9 15l1.5 1.5v0a.707.707 0 0 0 1 0v0L15 13'/></svg>`;
  const cancelSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 32 32'><path d='m7 7 18 18M7 25 25 7' style='fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:2px'/></svg>`;
  const messageInput = document.getElementById('message-input');
  const conversationList = document.getElementById('conversation-list');

  const setInitialMessageInputHeight = () => {
    messageInput.style.height = '38px';
  };

  setInitialMessageInputHeight();

  window.addEventListener('message', (event) => {
    const message = event.data;

    const getHtmlWithCodeCopy = (text) => {
      const html = new DOMParser().parseFromString(text, 'text/html');
      const codeElements = html.querySelectorAll('pre > code');

      codeElements.forEach((codeElement) => {
        const preCode = codeElement.parentElement;
        preCode.classList.add('code-section', 'rounded-lg');

        const buttonWrapper = document.createElement('div');
        buttonWrapper.classList.add('code-actions-wrapper', 'flex', 'gap-4', 'flex-wrap', 'items-center', 'right-2', 'top-1', 'absolute');

        // Create copy to clipboard button
        const copyButton = document.createElement('button');
        copyButton.title = 'Copy to clipboard';
        copyButton.innerHTML = copySvg;

        copyButton.classList.add('code-copy-button', 'p-1', 'flex', 'items-center', 'rounded-lg');
        buttonWrapper.append(copyButton);

        preCode.prepend(buttonWrapper);
      });

      return html.documentElement.innerHTML;
    };

    const getResponseTextHtml = text => {
      switch (text.type) {
        case 'plain':
          return `<div>${text.value}</div>`;
        case 'error':
          return `<div class='response-text-error'>${text.value}</div>`;
        case 'js':
          return getHtmlWithCodeCopy(marked.parse(`\`\`\`\n${text.value}\n\`\`\``));
        case 'markdown':
          return getHtmlWithCodeCopy(marked.parse(text.value));
        default:
          return '';
      }
    };

    const scrollToLastMessage = () => {
      conversationList.scrollTo({
        top: conversationList.scrollHeight,
        behavior: 'smooth',
      });
    };

    switch (message.type) {
      case 'addQuestion': {
        conversationList.innerHTML +=
          `<div class='p-4 self-end relative' style='background: var(--vscode-input-background)'>
            <h2 class='font-bold mb-3 flex items-center'>${userSvg}<span class='ml-1'>You</span></h2>
            <div class='overflow-y-auto question-box'>${message.value}</div>
          </div>`;
        scrollToLastMessage();
        break;
      }
      case 'setLoading': {
        const loadingContainer = document.querySelector('.loading-container');
        messageInput.setAttribute('disabled', 'disabled');

        if (!loadingContainer) {
          conversationList.innerHTML +=
            `<div class='loading-container p-4 self-end flex justify-between'>
              ${loadingSvg}
              <button id='cancel-request-button' class='rounded-lg p-1.5'>
                ${cancelSvg}
              </button>
            </div>`;
        }
        scrollToLastMessage();
        break;
      }
      case 'addResponseTexts': {
        const texts = message.value;
        const loadingContainer = document.querySelector('.loading-container');

        loadingContainer?.remove();

        conversationList.innerHTML +=
          `<div class='p-4 self-end'>
            <h2 class='font-bold mb-3 flex'>${polySvg}<span class='ml-1.5'>Poly</span></h2>
            ${texts.map(text => getResponseTextHtml(text)).join('')}
          </div>`;
        scrollToLastMessage();
        messageInput.removeAttribute('disabled');
        messageInput.focus();
        break;
      }
      case 'clearConversation':
        clearConversation();
        break;
      case 'focusMessageInput':
        messageInput?.focus();
        break;
      default:
        break;
    }
  });

  const isCommand = value => COMMANDS.includes(value.substring(1).split(' ')[0]);

  const processMessageInputValue = () => {
    const value = messageInput.value;
    if (value?.length > 0) {
      if (isCommand(value)) {
        vscode.postMessage({
          type: 'sendCommand',
          value: value.substring(1),
        });
      } else {
        vscode.postMessage({
          type: 'sendQuestion',
          value,
        });
      }

      messageInput.value = '';
      setInitialMessageInputHeight();
    }
  };

  const postCancelRequestMessage = () => {
    vscode.postMessage({
      type: 'cancelRequest',
    });
  };

  const clearConversation = () => {
    document.getElementById('conversation-list').innerHTML = '';
    messageInput.value = '';
    setInitialMessageInputHeight();
  };

  messageInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      processMessageInputValue();
    }
  });
  messageInput.addEventListener('input', function(event) {
    this.style.height = '0';
    this.style.height = `${this.scrollHeight + 2}px`;
  }, false);

  document.getElementById('send-message-button').addEventListener('click', (e) => {
    e.preventDefault();
    processMessageInputValue();
  });

  document.addEventListener('click', e => {
    const targetButton = e.target.closest('button');

    if (!targetButton) {
      return;
    }
    if (targetButton.id === 'cancel-request-button') {
      postCancelRequestMessage();
    } else if (targetButton.classList?.contains('code-copy-button')) {
      const preElement = targetButton.closest('pre');
      const code = preElement.querySelector('code').innerText;

      navigator.clipboard.writeText(code)
        .then(() => {
          targetButton.innerHTML = copyCheckSvg;

          setTimeout(() => {
            targetButton.innerHTML = copySvg;
          }, 2000);
        });
    }
  });

})();
