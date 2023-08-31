### 0.3.2
* Avoid create config.env file if polyapi's library is not installed.
* Fix polyapi's library credentials path on Windows.

### 0.3.1
* Updated 'Too many requests' error message.

### 0.3.0
* Adjusted 'Too many requests' error message.

### 0.2.50
* Conversation history based on workspace folder.

### 0.1.50
* Fix: Escape questions on render
* Fix: Redis string format when saving.
* Fix: Store message before sending it to science server.

### 0.1.48
* Remember tree state.

### 0.1.47
* Fix for sending questions with escaped characters.

### 0.1.46
* Stream api implemented on assistant.

### 0.1.45
* Prevent focus being stolen by assistant.

### 0.1.44
* Added conversation history to assistant.

### 0.1.43
* Fix missing lodash lib.

### 0.1.42
* Removed pattern checks for configuration properties

### 0.1.41
* Added /c command as alternative to /clear

### 0.1.40
* Fix infinite `typescript.restartTsServer` on edge-case.

### 0.1.39
* Removed debug logging

### 0.1.38
* Changed description for Variables

### 0.1.37
* Added variable into Poly tree
* Updated colors of nodes in Poly tree

### 0.1.36
* Synchronization of credentials across client library and vscode extension.

### 0.1.35
* Poly setup through graphic UI
* Sync credentials from vscode extension to poly lib.

### 0.1.34
* Updated empty credentials text.
* Added action to go to settings on notification when credentials are empty.

### 0.1.33
* Enable textarea typing when sending poly question.

### 0.1.32
* Add setup message if credentials are not found.

### 0.1.31
* Apply and copy vscode markdown styles instead of using "dark-invert" feature from tailwindcss typography plugin
* Fixed responsive answer. Tailwind typography plugin was applying an arbitrary max-width.

### 0.1.30
* Applied tailwindcss typography plugin for ai responses.

### 0.1.29
* Fixed input box for question focus lost when sending a question

### 0.1.28
* Preserve newlines, line breaks and whitespace in question's box.

### 0.1.27
* Added common module

### 0.1.26
* Added tenant name information to public functions

### 0.1.25
* Updated Authorization

### 0.1.24
* Set textarea disabled when sending a question through chat.

### 0.1.23
* Removed "Copy selection to Poly" button due a vscode issue on Windows platform.

### 0.1.22
* Added webhook description

### 0.1.21
* Fixed publisher name

### 0.1.20
* Fixed tree label

### 0.1.19
* Fixed auth function copy action

### 0.1.18
* Updated tooltips and copied code for changed specifications

### 0.1.17
* Fixed tooltip for server functions

### 0.1.16
* Fixed tooltip and copied code for URL, Custom and Auth functions

### 0.1.15
* Fixed tooltip for functions when payload arguments are present

### 0.1.14
* Fixed copied code when payload arguments are present

### 0.1.13
* Updated Poly library tree icon

### 0.1.12
* Using polling instead of event listening for library data changes

### 0.1.11
* Improved Poly library change listener

### 0.1.10
* Updated error message from Poly chat

### 0.1.9
* Updated icon for library index tree
* Updated copied text for context

### 0.1.8
* Some library index tree related improvements

### 0.1.7
* Added library index tree

### 0.1.6
* Fixed issue with Poly not showing when no workspace is open
* Updated auto restart of TS server

### 0.1.5
* Updated extension activity bar icon
* Only Copy action in context menu

### 0.1.4
* Added extension icon
* Updated extension "developer"
* Updated extension "description"
* Updated README with Poly API client library usage

### 0.1.3
* Restart TS server when Poly library is changed
* Changed placeholder for message input

### 0.1.2
* Added shortcut to open Poly
* Message input grows height
* Removed header
* Scroll to loading indicator
* Clear messages action added
* Cancel request action added
* Showing error message

### 0.1.1
* Changed default value of API base URL to staging server

### 0.1.0
* Initial release of the extension.
* Query server for function recommendations
* Copy code to clipboard
