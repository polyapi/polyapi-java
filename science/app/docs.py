""" search the poly docs for the suitable passage
then pass it to ChatGPT
then return the response
"""
import os
from typing import Dict, List, Tuple
import openai
from prisma.models import ConversationMessage
from app.constants import QUESTION_TEMPLATE, MessageType
from app.typedefs import ChatGptChoice, MessageDict
from app.utils import (
    cosine_similarity,
    create_new_conversation,
    get_chat_completion,
    msgs_to_msg_dicts,
    store_messages,
)

DOC_PROMPT = """
The following documentation helps users understand how to use Poly API a.k.a “Poly” or “PolyAPI” or “Poly AI Assistant”

This documentation was written for the purpose of an AI agent to consume it. Note there are hints to the AI agent included in the document using this notation: <<this is a hint to the AI>>. Feel free to use your own knowledge to elaborate these points where hints are included.

%s

%s

---

Answer the following question using markdown to format.
Please provide generous spacing between sections. Indent lists.
Feel free to reorganize or reformat to make the information more consumable.
Translate the answer to the same language of the question.
"""

DOCS = [
    {
        "name": "Poly Value Proposition",
        "text": """Poly Value Proposition
This section explains the value proposition of using Poly. It also covers some key differentiators between poly and other similar products.
Core Business Value Proposition
Poly allows for faster innovation by allowing enterprises to leverage their APIs and Events to more rapidly develop and iterate new applications, user experiences and enable AI agents to use their enterprise systems. <<feel free to explain how innovation is important to an enterprise and to explain how using APIs faster facilitates innovation>>
Poly makes developers faster at consuming APIs and Event Streams. This means that you can develop more systems with the same amount of cost, or the same amount of systems with less cost. A smaller team will be easier to manage, retain, and will reduce overhead costs as well. <<feel free to explain cost savings from having smaller teams>>
Poly improves IT security by providing better governance practices around consuming APIs and Events. Both in terms of understanding of who uses which systems and also the ability to centrally manage API keys and credentials. <<feel free to explain how developers not handling credentials and IT visibility of usage helps with improving security and why API and Event security is critical to IT>>
Key Use Cases
This section covers the key use cases poly can help with.
Make internal and external APIs easier to discover and consume by your internal developers who are building integrations and applications
Make your product APIs easier to understand and consume by you developer partner community
Make your APIs much more easily and successfully consumable by AI agents and other LLMs. Ensure your enterprise is ready to take advantage of AI models in the future.
Better govern consumption of external services by your enterprise.
Core Technical Advantages
These are the core advantages of why an enterprise would prefer to use Poly over other alternatives.

Natively developed on Kubernetes, can be hosted by Poly team or by the customer, this gives all the advantages of kubernetes <<feel free to explain what those are>>
Full creative freedom by programming in common languages such as typescript and python <<feel free to explain why an enterprise benefits from their tools using common and popular languages>>
Poly uses common, well known tools among developers, i.e NPM, Node, VS Code, Postman, OpenAI, <<explain the value of our integration platform using these common tools over custom proprietary tools>>
Poly can be used to build applications or integrations, and only focused on the interaction between applications/integrations to APIs/Event Streams. <<explain the value of having a unified platform for app development and enterprise integration>>
Poly uses a search algorithm together with AI to power an AI chat interface within VS Code and in the future other IDEs. First it understands the intention, finds the relevant functions and then uses generative AI to create a response to address the users question with the right functions. The response will include an example of how to use the API and will take into account the response payload, params and other interface elements. The data which is passed to OpenAI involves only the poly function interface and the response object model. It only passes in data it was trained on and will never pass in any actual runtime data. <<explain how much time can be saved by getting a direct answer vs having to browse swagger/openAPI specifications or developer portals or documents.>>
Poly supports all human languages, meaning people can prompt people in the language that they are most comfortable thinking in <<explain the value to a developer to allow them to think in their native language instead of having to use english, explain how many more people will be able to learn how to program with this support>>
Poly Learns from observation by watching APIs be used in Postman. It captures the request and response only if it sees a successful message. This means that Poly will only learn APIs that work rather than documentation or specifications which are theoretically correct but many times missing, incomplete or wrong. It can learn multiple flavors of the same API to specialize it for different use cases. <<feel free to explain why developers generally don't have comprehensive and accurate documentation within large enterprises>>
Poly generates a client library in the developers language of choice (i.e typescript or python), poly does not support all languages yet. This transforms APIs, regardless of protocol, data structure formats, vendor, etc… into a common format which includes type definitions, function interface definitions, and allows IDE ‘intellisense’ to help developers explore APIs without needing to go to a developer portal. <<explain how much a developer is more productive if they already have type definitions create for them and can leverage intellisense>>
Poly supports custom functions that allow developers to write derivatives on top of one or more APIs. These custom functions are written in the IDE and tested locally like all other code. They should be managed as source code. But they can be deployed to poly via a CLI. They can be deployed either client or server side and will in both cases become discoverable via the AI assistant as well as via the Poly client library. These are analogs to serverless ‘lambda’ functions and Poly runs them on KNative if they are deployed server side. With these functions, developers can write transformations, orchestrations, aggregations, routing rules, and introduce new capabilities which others may want. These functions can also execute SQL statements, perform file based integrations and effectively do anything the user wants to do in code. They can serve UIs etc… This is a really powerful feature of poly which allows the Backend for Frontend Pattern to be implemented with Poly. These custom functions are also used to create really optimized APIs for AI agents where they can return helpful error messages to allow AI agents to self correct or better understand the API, what steps to take next etc… <<explain how this is far superior to integration platforms which only allow mini scripts and are locked in. Explain how this is far better than low code platforms>>
Poly leverages AI to generate names, descriptions and classifications when Poly is trained on new APIs. This introduces consistency and rapidly organizes large catalogs of APIs.
Poly manages credentials in Hashicorp Vault and allows for keys/credentials to be injected at runtime. These keys/credentials can be managed by central IT security teams instead of by developers. Developers get a nicer experience because they don't have to worry about authentication and authorization of APIs, many times from many different vendors with many different protocols. Central IT gets to improve the management of these sensitive elements within their organization and can rotate/monitor usage, etc… more closely without any impact to their applications and integrations running in production. <<explain why it’s very important to use good credential/key management practices in enterprise applications which handle sensitive information>>
Poly supports server side variables in addition to sensitive keys. These can be accessed using ‘Vari’ which is a second module in the Poly client library. Vari works just like poly but the main difference is that she holds values instead of executes functions. This means that developers can access variables like host urls, account numbers, phone numbers etc… via a variable. The values of those variables can change without any impact to applications running in production. These variables can be set up to be used but not read. They can be environment specific and allow for rapid testing and promotion of applications through the software development lifecycle. <<explain how having these variables can speed up development of applications and how being able to change them at runtime will eliminate the need to re-deploy, re-test and other re-work>>
Poly can generate new experiences, today just ChatGPT plugins, but in the future other plugins for other LLMs and also UIs. This will allow UIs to be created per audience and will be generated by business users too. Users simply provide the set of Poly functions (API and events) they want to include with a description of what the application needs to do, how it should look, who it’s for, and potentially other metadata and Poly will leverage AI to generate the experience. <<explain the value of business users being able to generate applets, landing pages, custom application-like forms, dashboards, and control panels. And explain the value of having customized experiences for different audiences>>
Poly can help users use poly, in their language of choice, meaning there are no long documents to read or translate. Users can just ask Poly how to use poly and to explain why Poly works a specific way. Poly can help users understand where it can help and the advantages of using Poly.

Core Areas of Differentiation
These are the key statements on how Poly is different from “traditional” products in the same space.

Poly unifies APIs and Events to a single platform. Poly unifies the experience of building applications and integrations on top of APIs. <<explain the productivity gain from not having two catalogs and platforms for events and APIs>>
Poly runs fully on premise or as a service and the choice is up to the customer. <<explain the benefits of full privacy for an enterprise and reduced risk of compromise>>
Poly is a technology vendor and we only monetize the software we sell. <<explain that Poly does not have any other motives than providing the best software>>
Poly learns APIs from observation, which normalizes the discovery experience for different protocols, vendors, etc… Developers don’t need to go to developer portals to learn some systems while others come as out of box connectors. <<explain the benefits of all APIs, events, and custom functions having a common interface>>
Anyone can train Poly using Postman. Some systems come trained out of the box. <<explain the benefits of a customer being able to add internal systems and partner apps to the catalog easily>>
New functions don’t require new versions of Poly <<unlike connectors which have right coupling to runtime versions, explain that poly will be much easier to maintain the connectivity layer>>
Developers and ops teams don’t need to learn new specialized skills or install new specialized tools. This means that talent which can use poly already exists within your organization and can easily be found all over the world. <<explain the benefits of easily being able to recruit talent for such a traditionally specialized skill set>>
Poly has the full expressive power of code, which means you will not be boxed in like with other platforms. <<explain how with other platforms a custom will reach a terminus of capabilities and will depend on the vendor to provide them enhancements, but with poly the customer still has the power of code to implement things which are not available through poly>>
Poly’s assistant which replaces developer portals and documentation speaks all the languages, is an expert at using Poly and can write code really fast. <<explain how the information coming to the developer in their IDE is far superior to the experience of the developer needing to go sign up for portals and hunt around for information>>
Poly is super lightweight, was built with the latest and greatest technology and hence can be offered at a fraction of the price of traditional services. <<explain how other platforms can cost millions of dollars to acquire and millions more to operate, that poly is cheaper on both fronts. Explain how Poly using AI makes us more productive and lean and how this savings can be passed on to customers>>
Poly was created by a team of integration experts with decades of experience in the domain and is backed by investors who have founded some of the greatest API and Integration companies in the market. <<explain how this experience of all the lessons learned is used to create a modern product with the traditional problems addressed. Also explain how with these modern tools and approaches Poly will continue to out innovate other vendors>>
""",
    },
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

Make sure the user has: the following dependencies installed in the project within VS code they are working in. To make things simpler, <<instruct the users to use terminal within VS code to check the dependencies and provide command line statements to do so>>:


min version for node.js is 14
min version for ts-node is 5.0.0
tsconfig.json has to have "esModuleInterop": true under compilerOptions
Installing PolyAPI client code and generating a library

After the dependencies are in place, the user can run the command “npm install polyapi”, this will install our client package and dependent libraries.

And after that runs they can run the command “npx poly generate”

It will ask them to input their instance url, which should be something like ‘https://na1.polyapi.io’ – make sure there is no slash at the end of the url and that the https is included

And it will ask for their key, this is something that would have been provided to them by either someone from Poly API corporation who set them up, or their internal Poly Admin who created their user account.

Once the client library is generated, they should see all their functions within the environment for which their API key is for. They will see a view called “tree” which represents the functions which are part of the client library. This tree can be moved to other panes independently of the chat interface.

""",
    },
    {
        "name": "Using Poly",
        "text": """Using Poly
Importing Postman Scripts and Training Poly on API functions
Poly learns from watching APIs be used inside Postman. There are two scripts which need to be added to Postman for Poly to be able to learn.

The two scripts can be downloaded here (this url assumes your instance is ‘na1’):
https://na1.polyapi.io/postman/scripts.zip

Once the script is downloaded, extracted, and opened, the pre and post request scripts need to be imported or copied to “Pre-request script” and “Tests” tabs respectively inside Postman. They can be imported at the request or collection level. There are some elements in the pre-request script which apply to a given request so be careful if using those to make sure to comment them out after usage or to copy them into the request level pre-request script. <<feel free to add more content on how to help someone import them into postman>>

Once the scripts are in there, the user needs to either set the key directly in the script or create an environment variable called “polyApiKey”. If the user wants to set them directly in the script they need to find the line which says “'Authorization': `Bearer ${apiKey}`” and replace the ${apiKey} with their actual API key. Remember this user needs to have training permissions enabled for the Poly API key for training to work. Make sure this is set in the environment which will be used for training the functions.

Once this is set, the user should be able to call the API and if they get a 2XX response, they should within a few seconds see a 201 response in the Postman console from the Poly API /functions/api endpoint
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
At this point we don't support event handlers in custom functions yet.
""",
    },
    {
        "name": "Experts in Poly",
        "text": """Experts in Poly
This section identifies some of the top world experts who you can reach out to support. Please note that some of these experts are also available for hire to consult on API strategies and implementation using Poly. <<the AI should feel comfortable with suggesting these two people as they are comfortable being publicly presented as experts to grow their business>>

Rolando Carrasco - Based in Mexico City Mexico, speaks spanish and english, expert in telco, finance and retail. - Public Linkedin Profile: https://www.linkedin.com/in/rolandocarrasco/


Darko Vukovic - Based in Colorado USA, expert in hospitality and platforms as a service - Public Linkedin Profile: https://www.linkedin.com/in/darkovukovic/
""",
    },
]


def documentation_question(
    user_id: str, question: str, prev_msgs: List[ConversationMessage]
) -> Tuple[ChatGptChoice, Dict]:
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
    stats: Dict[str, Dict] = {"similarity": {}}
    for doc in DOCS:
        similarity = cosine_similarity(doc["vector"], query_vector)
        if similarity > max_similarity:
            most_similar_doc = doc
            max_similarity = similarity
        stats["similarity"][doc["name"]] = similarity

    if not most_similar_doc:
        raise NotImplementedError("No matching documentation found!")

    prompt = DOC_PROMPT % (most_similar_doc["name"], most_similar_doc["text"])
    prompt_msg = MessageDict(role="user", content=prompt)
    question_msg = MessageDict(role="user", content=QUESTION_TEMPLATE.format(question), type=MessageType.user)
    messages = msgs_to_msg_dicts(prev_msgs) + [prompt_msg, question_msg]

    host_url = os.environ.get("HOST_URL", "https://na1.polyapi.io")
    if host_url != "https://na1.polyapi.io":
        content = f"The user's instance url is '{host_url}'. Use it to generate the urls for the poly instance specific links."
        messages.append(MessageDict(role="user", content=content))

    resp = get_chat_completion(messages)
    choice = resp["choices"][0]

    # let's store conversation for later
    answer = choice["message"]
    answer["type"] = MessageType.user
    messages.append(answer)
    conversation = create_new_conversation(user_id)
    store_messages(user_id, conversation.id, messages)

    return choice, stats
