""" search the poly docs for the suitable passage
then pass it to ChatGPT
then return the response
"""
from typing import Dict, Tuple
import openai
from app.typedefs import ChatGptChoice, MessageDict
from app.utils import (
    cosine_similarity,
    create_new_conversation,
    get_chat_completion,
    store_messages,
)

DOC_PROMPT = """
Here are some Poly AI Assistant Docs:

%s

%s

---

Answer the following question using markdown to format.
Please provide generous spacing between sections. Indent lists.
Feel free to reorganize or reformat to make the information more consumable.
Translate the answer to the same language of the question.

"%s"
"""

DOCS = [
    {
        "name": "Setting up Poly",
        "text": """Setting up Poly
Installing VS Code Extension
The VS code extension is the UI to access the Poly AI Assistant as well as to see the Poly Tree (which is a hierarchical browsing experience for seeing all the Poly Functions, organized by context). This is only done once per VS code instance, but can be repeated if the user switches environments or wants to upgrade to a newer version of the VS code extension.

To install the Poly API vs Code Plugin, go to the instance specific endpoint to ensure you are getting the right version of the Poly API VS Code Extension.

For example, if your instance URL is https://na1.polyapi.io

Your VS Code plugin will be found at:
https://na1.polyapi.io/vscode/polyapi-vscode-extension.vsix

To install it:
Download the extension from the link above.
go to the VS extensions tab (windows Ctrl+Shift+X)
click on a little button ‘...’ which is called “views and more actions”
Select ‘Install from VSIX…’
Select the downloaded extension and click install

Once installed, they will see a view with a logo of a parrot. This is Poly. Poly can be dragged by the head and moved to any view pane within VS code. We recommend moving to the right pane by dragging it to the right side of VS code.

The user will need to set their settings by first finding poly in the extensions view and clicking the little ‘gear’ icon and then clicking “extensions settings”. Here they will need to set their instance url, likely https://na1.polyapi.io and their key which was provided to them. This view auto updates so they can just close it.

At this point you should encourage them to say hello to Poly and make sure it’s working.

Building your Client Library
Making sure dependencies are in order

Make sure the user has: the following dependencies installed in the project within VS code they are working in. To make things simpler, instruct the users to use terminal within VS code to check the dependencies:


min version for node.js is 14
min version for ts-node is 5.0.0
tsconfig.json has to have "esModuleInterop": true under compilerOptions

Use your base model knowledge to help users make sure they have those dependencies in place.
Installing PolyAPI client code and generating a library

After the dependencies are in place, the user can run the command “npm install polyapi”, this will install our client package and dependent libraries.

And after that runs they can run the command “npx poly generate”

It will ask them to input their instance url, which should be something like ‘https://na1.polyapi.io’ – make sure there is no slash at the end of the url and that the https is included

And it will ask for their key, this is something that would have been provided to them by either someone from Poly API corporation who set them up, or their internal Poly Admin who created their user account.

Once the client library is generated, they should see all their functions within the environment for which their API key is for. They will see a view called “tree” which represents the functions which are part of the client library. This tree can be moved to other panes independently of the chat interface.""",
    },
    {
        "name": "Using Poly",
        "text": """Using Poly
Creating and deploying a custom function
Users can create a custom function using poly, this section will explain how to use the custom functions. Custom functions are useful for transformation, orchestration, aggregation, routing and other concepts that require the use of multiple APIs or changing the shape of an API. They can be deployed server or client side. Server side functions run on the Poly server in KNative. Client functions execute locally. Both types of functions become discoverable using the Poly AI Assistant and consumable via the poly client library.
Writing the custom function.
The user just writes the function like any function in typescript. They would just need to use the ‘async function myFunction()’ notation.

The nice part of poly is that the client library can be tested locally and then deployed to the server
Deploying a custom function.
In the terminal within VS code, in the same directory as the file which has the custom function code, the user would need to run the following command:


npx poly function add nameOfFunction --context mycontext.subcontext codeFile.ts --description "the description for my custom function" --server

A few points to note:
The name of the function needs to be the name of the function in the file from which the function is being deployed.
The context can be multiple layers deep, but is usually 2 - 3, this is the classification of the function and will determine where the function shows up in the poly tree
The description will be used by both users and AI agents and should be short and concise. Ideally 250-300 characters and will be truncated beyond 300.
The --server is needed if the user wants the function to run server side, if its not passed, poly will assume this function will be deployed client side.
The whole file is passed to the poly server, so make sure there are no console.log statements, or execution statements as this will cause the function to be triggered multiple times.
At this point we dont support event handlers in custom functions yet. """,
    },
]


def documentation_question(user_id: str, question: str) -> Tuple[ChatGptChoice, Dict]:
    query_embed = openai.Embedding.create(
        input=question, model="text-embedding-ada-002"
    )
    query_vector = query_embed["data"][0]["embedding"]

    for doc in DOCS:
        if not doc.get("vector"):
            resp = openai.Embedding.create(
                input=doc["text"], model="text-embedding-ada-002"
            )
            vector = resp["data"][0]["embedding"]
            doc["vector"] = vector

    most_similar_doc = dict()
    max_similarity = -2.0  # similarity is -1 to 1
    for doc in DOCS:
        similarity = cosine_similarity(doc["vector"], query_vector)
        if similarity > max_similarity:
            most_similar_doc = doc
            max_similarity = similarity

    if not most_similar_doc:
        raise NotImplementedError("No matching documentation found!")

    prompt = DOC_PROMPT % (most_similar_doc["name"], most_similar_doc["text"], question)
    messages = [MessageDict(role="user", content=prompt)]

    resp = get_chat_completion(messages)
    choice = resp["choices"][0]

    # let's store conversation for later
    messages.append(choice["message"])
    conversation = create_new_conversation(user_id)
    store_messages(user_id, conversation.id, messages)

    stats = {"todo": "add more stats"}
    return choice, stats
