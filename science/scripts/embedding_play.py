#!/usr/bin/env python3
import sys
import os
import json
import openai
from openai.embeddings_utils import cosine_similarity
from app.completion import spec_prompt


# blog post: https://openai.com/blog/new-and-improved-embedding-model

# example of code search: https://github.com/openai/openai-cookbook/blob/main/examples/Code_search.ipynb

SPECS = [
    {
        "id": "ec66c324-80fe-4d9a-a5fa-2f7f38384155",
        "type": "apiFunction",
        "context": "comms.messaging",
        "name": "twilioSendSms",
        "description": "This API call allows sends SMS messages through Twilio's messaging service. The user can specify the number of the recipient as a string using the coutry code as string with no spaces, for example +16504859634, as well as the message body. The response payload returns detailed information about the status of the message, including its unique identifier and any error messages. This function does not require twilio credentials as they are alreayd store server side.",
        "function": {
            "arguments": [
                {
                    "name": "My_Phone_Number",
                    "required": True,
                    "type": {"kind": "primitive", "type": "string"},
                },
                {
                    "name": "message",
                    "required": True,
                    "type": {"kind": "primitive", "type": "string"},
                },
            ],
            "returnType": {
                "kind": "object",
                "schema": {
                    "$schema": "http://json-schema.org/draft-06/schema#",
                    "definitions": {
                        "SubresourceUris": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {"media": {"type": "string"}},
                            "required": ["media"],
                            "title": "SubresourceUris",
                        }
                    },
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "body": {"type": "string"},
                        "num_segments": {"type": "string", "format": "integer"},
                        "direction": {"type": "string"},
                        "from": {"type": "string"},
                        "date_updated": {"type": "string"},
                        "price": {"type": "null"},
                        "error_message": {"type": "null"},
                        "uri": {"type": "string"},
                        "account_sid": {"type": "string"},
                        "num_media": {"type": "string", "format": "integer"},
                        "to": {"type": "string"},
                        "date_created": {"type": "string"},
                        "status": {"type": "string"},
                        "sid": {"type": "string"},
                        "date_sent": {"type": "null"},
                        "messaging_service_sid": {"type": "null"},
                        "error_code": {"type": "null"},
                        "price_unit": {"type": "string"},
                        "api_version": {"type": "string", "format": "date"},
                        "subresource_uris": {"$ref": "#/definitions/SubresourceUris"},
                    },
                    "required": [
                        "account_sid",
                        "api_version",
                        "body",
                        "date_created",
                        "date_sent",
                        "date_updated",
                        "direction",
                        "error_code",
                        "error_message",
                        "from",
                        "messaging_service_sid",
                        "num_media",
                        "num_segments",
                        "price",
                        "price_unit",
                        "sid",
                        "status",
                        "subresource_uris",
                        "to",
                        "uri",
                    ],
                    "title": "ReturnType",
                },
            },
        },
        "visibilityMetadata": {"visibility": "PUBLIC"},
    },
    {
        "id": "83704918-28d0-4c7f-8897-7e27ad291c96",
        "type": "apiFunction",
        "context": "serviceNow.incidents",
        "name": "create",
        "description": "Create a new incident in ServiceNow with details like priority, state, short description, impact, urgency, and assignment group. Returns the created incident with its unique identifier (sys_id) and other incident details.",
        "function": {
            "arguments": [
                {
                    "name": "payload",
                    "required": True,
                    "type": {
                        "kind": "object",
                        "properties": [
                            {
                                "name": "impact",
                                "required": True,
                                "type": {"kind": "primitive", "type": "number"},
                            },
                            {
                                "name": "priority",
                                "required": True,
                                "type": {"kind": "primitive", "type": "number"},
                            },
                            {
                                "name": "businessImpact",
                                "required": True,
                                "type": {"kind": "primitive", "type": "string"},
                            },
                            {
                                "name": "businessUrgency",
                                "required": True,
                                "type": {"kind": "primitive", "type": "number"},
                            },
                            {
                                "name": "businessSeverity",
                                "required": True,
                                "type": {"kind": "primitive", "type": "number"},
                            },
                            {
                                "name": "escalationRequest",
                                "required": True,
                                "type": {"kind": "primitive", "type": "string"},
                            },
                        ],
                    },
                }
            ],
            "returnType": {
                "kind": "object",
                "schema": {
                    "$schema": "http://json-schema.org/draft-06/schema#",
                    "definitions": {
                        "Result": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "parent": {"type": "string"},
                                "reassignment_count": {
                                    "type": "string",
                                    "format": "integer",
                                },
                                "activity_due": {"type": "string"},
                                "assigned_to": {"type": "string"},
                                "severity": {"type": "string", "format": "integer"},
                                "comments": {"type": "string"},
                                "approval": {"type": "string"},
                                "sla_due": {"type": "string"},
                                "comments_and_work_notes": {"type": "string"},
                                "due_date": {"type": "string"},
                                "sys_mod_count": {
                                    "type": "string",
                                    "format": "integer",
                                },
                                "reopen_count": {"type": "string", "format": "integer"},
                                "sys_tags": {"type": "string"},
                            },
                            "required": [
                                "active",
                                "activity_due",
                                "additional_assignee_list",
                                "approval",
                            ],
                            "title": "Result",
                        },
                        "OpenedBy": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "link": {
                                    "type": "string",
                                    "format": "uri",
                                    "qt-uri-protocols": ["https"],
                                },
                                "value": {"type": "string"},
                            },
                            "required": ["link", "value"],
                            "title": "OpenedBy",
                        },
                    },
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"result": {"$ref": "#/definitions/Result"}},
                    "required": ["result"],
                    "title": "ReturnType",
                },
            },
        },
        "visibilityMetadata": {"visibility": "ENVIRONMENT"},
    },
    {
        "id": "a9470f97-9a1b-4c59-879a-805cf0b4172a",
        "type": "apiFunction",
        "context": "serviceNow.incidents",
        "name": "getActiveLimited",
        "description": "Retrieve a limited number of active incidents from the ServiceNow incident table. Returns incident details such as state, priority, description, and assignment group. Useful for fetching a specific number of active incidents for efficient processing and management.",
        "function": {
            "arguments": [
                {
                    "name": "incidentCount",
                    "required": True,
                    "type": {"kind": "primitive", "type": "number"},
                }
            ],
            "returnType": {
                "kind": "object",
                "schema": {
                    "$schema": "http://json-schema.org/draft-06/schema#",
                    "definitions": {
                        "Result": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "parent": {"type": "string"},
                                "made_sla": {"type": "string", "format": "boolean"},
                                "caused_by": {"type": "string"},
                                "watch_list": {"type": "string"},
                                "upon_reject": {"type": "string"},
                                "sys_updated_on": {
                                    "type": "string",
                                    "format": "date-time",
                                },
                                "child_incidents": {
                                    "type": "string",
                                    "format": "integer",
                                },
                                "hold_reason": {"type": "string"},
                                "origin_table": {"type": "string"},
                                "task_effective_number": {"type": "string"},
                                "approval_history": {"type": "string"},
                                "number": {"type": "string"},
                                "resolved_by": {"type": "string"},
                                "sys_updated_by": {"type": "string"},
                                "opened_by": {"$ref": "#/definitions/CallerID"},
                                "user_input": {"type": "string"},
                                "sys_created_on": {
                                    "type": "string",
                                    "format": "date-time",
                                },
                                "sys_domain": {"$ref": "#/definitions/CallerID"},
                                "state": {"type": "string", "format": "integer"},
                                "route_reason": {"type": "string"},
                                "sys_created_by": {"type": "string"},
                                "knowledge": {"type": "string", "format": "boolean"},
                                "order": {"type": "string"},
                                "calendar_stc": {"type": "string"},
                                "closed_at": {"type": "string"},
                                "cmdb_ci": {"type": "string"},
                                "delivery_plan": {"type": "string"},
                                "contract": {"type": "string"},
                                "impact": {"type": "string", "format": "integer"},
                                "active": {"type": "string", "format": "boolean"},
                                "work_notes_list": {"type": "string"},
                                "business_service": {"type": "string"},
                                "business_impact": {"type": "string"},
                                "priority": {"type": "string", "format": "integer"},
                                "sys_domain_path": {"type": "string"},
                                "rfc": {"type": "string"},
                                "time_worked": {"type": "string"},
                                "expected_start": {"type": "string"},
                                "opened_at": {"type": "string", "format": "date-time"},
                                "business_duration": {"type": "string"},
                                "group_list": {"type": "string"},
                                "work_end": {"type": "string"},
                                "caller_id": {"$ref": "#/definitions/CallerID"},
                                "reopened_time": {"type": "string"},
                                "resolved_at": {"type": "string"},
                                "approval_set": {"type": "string"},
                                "subcategory": {"type": "string"},
                                "work_notes": {"type": "string"},
                                "universal_request": {"type": "string"},
                                "short_description": {"type": "string"},
                                "close_code": {"type": "string"},
                                "correlation_display": {"type": "string"},
                                "delivery_task": {"type": "string"},
                                "work_start": {"type": "string"},
                                "assignment_group": {"type": "string"},
                                "additional_assignee_list": {"type": "string"},
                                "business_stc": {"type": "string"},
                                "cause": {"type": "string"},
                                "description": {"type": "string"},
                                "origin_id": {"type": "string"},
                                "calendar_duration": {"type": "string"},
                                "close_notes": {"type": "string"},
                                "notify": {"type": "string", "format": "integer"},
                                "service_offering": {"type": "string"},
                                "sys_class_name": {"type": "string"},
                                "closed_by": {"type": "string"},
                                "follow_up": {"type": "string"},
                                "parent_incident": {"type": "string"},
                                "sys_id": {"type": "string"},
                                "contact_type": {"type": "string"},
                                "reopened_by": {"type": "string"},
                                "incident_state": {
                                    "type": "string",
                                    "format": "integer",
                                },
                                "urgency": {"type": "string", "format": "integer"},
                                "problem_id": {"type": "string"},
                                "company": {"type": "string"},
                                "reassignment_count": {
                                    "type": "string",
                                    "format": "integer",
                                },
                                "activity_due": {"type": "string"},
                                "assigned_to": {"type": "string"},
                                "severity": {"type": "string", "format": "integer"},
                                "comments": {"type": "string"},
                                "approval": {"type": "string"},
                                "sla_due": {"type": "string"},
                                "comments_and_work_notes": {"type": "string"},
                                "due_date": {"type": "string"},
                                "sys_mod_count": {
                                    "type": "string",
                                    "format": "integer",
                                },
                                "reopen_count": {"type": "string", "format": "integer"},
                                "sys_tags": {"type": "string"},
                                "escalation": {"type": "string", "format": "integer"},
                                "upon_approval": {"type": "string"},
                                "correlation_id": {"type": "string"},
                                "location": {"type": "string"},
                                "category": {"type": "string"},
                            },
                            "required": [
                                "active",
                                "activity_due",
                                "additional_assignee_list",
                                "approval",
                                "approval_history",
                                "approval_set",
                                "assigned_to",
                                "assignment_group",
                                "business_duration",
                                "business_impact",
                                "business_service",
                                "business_stc",
                                "calendar_duration",
                                "calendar_stc",
                                "caller_id",
                                "category",
                                "cause",
                                "caused_by",
                                "child_incidents",
                                "close_code",
                                "close_notes",
                                "closed_at",
                                "closed_by",
                                "cmdb_ci",
                                "comments",
                                "comments_and_work_notes",
                                "company",
                                "contact_type",
                                "contract",
                                "correlation_display",
                                "correlation_id",
                                "delivery_plan",
                                "delivery_task",
                                "description",
                                "due_date",
                                "escalation",
                                "expected_start",
                                "follow_up",
                                "group_list",
                                "hold_reason",
                                "impact",
                                "incident_state",
                                "knowledge",
                                "location",
                                "made_sla",
                                "notify",
                                "number",
                                "opened_at",
                                "opened_by",
                                "order",
                                "origin_id",
                                "origin_table",
                                "parent",
                                "parent_incident",
                                "priority",
                                "problem_id",
                                "reassignment_count",
                                "reopen_count",
                                "reopened_by",
                                "reopened_time",
                                "resolved_at",
                                "resolved_by",
                                "rfc",
                                "route_reason",
                                "service_offering",
                                "severity",
                                "short_description",
                                "sla_due",
                                "state",
                                "subcategory",
                                "sys_class_name",
                                "sys_created_by",
                                "sys_created_on",
                                "sys_domain",
                                "sys_domain_path",
                                "sys_id",
                                "sys_mod_count",
                                "sys_tags",
                                "sys_updated_by",
                                "sys_updated_on",
                                "task_effective_number",
                                "time_worked",
                                "universal_request",
                                "upon_approval",
                                "upon_reject",
                                "urgency",
                                "user_input",
                                "watch_list",
                                "work_end",
                                "work_notes",
                                "work_notes_list",
                                "work_start",
                            ],
                            "title": "Result",
                        },
                        "CallerID": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "link": {
                                    "type": "string",
                                    "format": "uri",
                                    "qt-uri-protocols": ["https"],
                                },
                                "value": {"type": "string"},
                            },
                            "required": ["link", "value"],
                            "title": "CallerID",
                        },
                    },
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "result": {
                            "type": "array",
                            "items": {"$ref": "#/definitions/Result"},
                        }
                    },
                    "required": ["result"],
                    "title": "ReturnType",
                },
            },
        },
        "visibilityMetadata": {"visibility": "ENVIRONMENT"},
    },
    {
        "id": "0b4b8c4c-36ff-4905-ad4c-ae330b1d2646",
        "type": "apiFunction",
        "context": "asana.tasks",
        "name": "getById",
        "description": "Retrieve a specific task by its ID from Asana. Returns task details such as assignee, status, completion, due date, followers, project memberships, and more. Useful for obtaining information about a single task within a project or workspace.",
        "function": {
            "arguments": [
                {
                    "name": "taskId",
                    "required": True,
                    "type": {"kind": "primitive", "type": "number"},
                }
            ],
            "returnType": {
                "kind": "object",
                "schema": {
                    "$schema": "http://json-schema.org/draft-06/schema#",
                    "definitions": {
                        "Data": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "gid": {"type": "string"},
                                "actual_time_minutes": {
                                    "$ref": "#/definitions/ActualTimeMinutes"
                                },
                                "assignee": {"$ref": "#/definitions/ActualTimeMinutes"},
                                "assignee_status": {"type": "string"},
                                "completed": {"type": "boolean"},
                                "completed_at": {
                                    "$ref": "#/definitions/ActualTimeMinutes"
                                },
                                "created_at": {"type": "string", "format": "date-time"},
                                "due_at": {"$ref": "#/definitions/ActualTimeMinutes"},
                                "due_on": {"$ref": "#/definitions/ActualTimeMinutes"},
                                "followers": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Workspace"},
                                },
                                "hearted": {"type": "boolean"},
                                "hearts": {"type": "array", "items": {}},
                                "liked": {"type": "boolean"},
                                "likes": {"type": "array", "items": {}},
                                "memberships": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Membership"},
                                },
                                "modified_at": {
                                    "type": "string",
                                    "format": "date-time",
                                },
                                "name": {"type": "string"},
                                "notes": {"type": "string"},
                                "num_hearts": {"type": "integer"},
                                "num_likes": {"type": "integer"},
                                "parent": {"$ref": "#/definitions/ActualTimeMinutes"},
                                "permalink_url": {
                                    "type": "string",
                                    "format": "uri",
                                    "qt-uri-protocols": ["https"],
                                },
                                "projects": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Workspace"},
                                },
                                "resource_type": {"type": "string"},
                                "start_at": {"$ref": "#/definitions/ActualTimeMinutes"},
                                "start_on": {"$ref": "#/definitions/ActualTimeMinutes"},
                                "tags": {"type": "array", "items": {}},
                                "resource_subtype": {"type": "string"},
                                "workspace": {"$ref": "#/definitions/Workspace"},
                            },
                            "required": [
                                "actual_time_minutes",
                                "assignee",
                                "assignee_status",
                                "completed",
                                "completed_at",
                                "created_at",
                                "due_at",
                                "due_on",
                                "followers",
                                "gid",
                                "hearted",
                                "hearts",
                                "liked",
                                "likes",
                                "memberships",
                                "modified_at",
                                "name",
                                "notes",
                                "num_hearts",
                                "num_likes",
                                "parent",
                                "permalink_url",
                                "projects",
                                "resource_subtype",
                                "resource_type",
                                "start_at",
                                "start_on",
                                "tags",
                                "workspace",
                            ],
                            "title": "Data",
                        },
                        "ActualTimeMinutes": {
                            "type": "object",
                            "additionalProperties": False,
                            "title": "ActualTimeMinutes",
                        },
                        "Workspace": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "gid": {"type": "string"},
                                "name": {"type": "string"},
                                "resource_type": {"type": "string"},
                            },
                            "required": ["gid", "name", "resource_type"],
                            "title": "Workspace",
                        },
                        "Membership": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "project": {"$ref": "#/definitions/Workspace"},
                                "section": {"$ref": "#/definitions/Workspace"},
                            },
                            "required": ["project", "section"],
                            "title": "Membership",
                        },
                    },
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"data": {"$ref": "#/definitions/Data"}},
                    "required": ["data"],
                    "title": "ReturnType",
                },
            },
        },
        "visibilityMetadata": {"visibility": "ENVIRONMENT"},
    },
    {
        "id": "63693ffb-cd2d-4dfb-b69b-23b8030bec9d",
        "type": "apiFunction",
        "context": "asana.tasks",
        "name": "create",
        "description": "Create a new task in Asana with specified project, assignee section, name, and notes. Returns the created task's details, including gid, projects, resource_type, created_at, modified_at, name, notes, assignee, and other relevant information.",
        "function": {
            "arguments": [
                {
                    "name": "projectId",
                    "required": True,
                    "type": {"kind": "primitive", "type": "number"},
                },
                {
                    "name": "sectionId",
                    "required": True,
                    "type": {"kind": "primitive", "type": "number"},
                },
                {
                    "name": "taskName",
                    "required": True,
                    "type": {"kind": "primitive", "type": "string"},
                },
                {
                    "name": "taskDescription",
                    "required": True,
                    "type": {"kind": "primitive", "type": "string"},
                },
            ],
            "returnType": {
                "kind": "object",
                "schema": {
                    "$schema": "http://json-schema.org/draft-06/schema#",
                    "definitions": {
                        "Data": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "gid": {"type": "string"},
                                "projects": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Workspace"},
                                },
                                "resource_type": {"type": "string"},
                                "created_at": {"type": "string", "format": "date-time"},
                                "modified_at": {
                                    "type": "string",
                                    "format": "date-time",
                                },
                                "name": {"type": "string"},
                                "notes": {"type": "string"},
                                "assignee": {"$ref": "#/definitions/Assignee"},
                                "parent": {"$ref": "#/definitions/Assignee"},
                                "actual_time_minutes": {"type": "integer"},
                                "completed": {"type": "boolean"},
                                "completed_at": {"$ref": "#/definitions/Assignee"},
                                "due_on": {"$ref": "#/definitions/Assignee"},
                                "due_at": {"$ref": "#/definitions/Assignee"},
                                "resource_subtype": {"type": "string"},
                                "start_on": {"$ref": "#/definitions/Assignee"},
                                "start_at": {"$ref": "#/definitions/Assignee"},
                                "tags": {"type": "array", "items": {}},
                                "workspace": {"$ref": "#/definitions/Workspace"},
                                "num_hearts": {"type": "integer"},
                                "num_likes": {"type": "integer"},
                                "memberships": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Membership"},
                                },
                                "hearts": {"type": "array", "items": {}},
                                "likes": {"type": "array", "items": {}},
                                "permalink_url": {
                                    "type": "string",
                                    "format": "uri",
                                    "qt-uri-protocols": ["https"],
                                },
                                "assignee_status": {"type": "string"},
                                "hearted": {"type": "boolean"},
                                "liked": {"type": "boolean"},
                                "followers": {
                                    "type": "array",
                                    "items": {"$ref": "#/definitions/Workspace"},
                                },
                            },
                            "required": [
                                "actual_time_minutes",
                                "assignee",
                                "assignee_status",
                                "completed",
                                "completed_at",
                                "created_at",
                                "due_at",
                                "due_on",
                                "followers",
                                "gid",
                                "hearted",
                                "hearts",
                                "liked",
                                "likes",
                                "memberships",
                                "modified_at",
                                "name",
                                "notes",
                                "num_hearts",
                                "num_likes",
                                "parent",
                                "permalink_url",
                                "projects",
                                "resource_subtype",
                                "resource_type",
                                "start_at",
                                "start_on",
                                "tags",
                                "workspace",
                            ],
                            "title": "Data",
                        },
                        "Assignee": {
                            "type": "object",
                            "additionalProperties": False,
                            "title": "Assignee",
                        },
                        "Workspace": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "gid": {"type": "string"},
                                "resource_type": {"type": "string"},
                                "name": {"type": "string"},
                            },
                            "required": ["gid", "name", "resource_type"],
                            "title": "Workspace",
                        },
                        "Membership": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "project": {"$ref": "#/definitions/Workspace"},
                                "section": {"$ref": "#/definitions/Workspace"},
                            },
                            "required": ["project", "section"],
                            "title": "Membership",
                        },
                    },
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"data": {"$ref": "#/definitions/Data"}},
                    "required": ["data"],
                    "title": "ReturnType",
                },
            },
        },
        "visibilityMetadata": {"visibility": "ENVIRONMENT"},
    },
]

if __name__ == "__main__":
    question = sys.argv[1]

    embedding_ids = set()
    if os.path.isfile("embedding_cache.json"):
        with open("embedding_cache.json", "r") as f:
            embeddings = json.loads(f.read())
            embedding_ids = {e['id'] for e in embeddings}
    else:
        embeddings = []

    query_embed = openai.Embedding.create(
        input=question, model="text-embedding-ada-002"
    )
    query_vector = query_embed["data"][0]["embedding"]

    with open('test_set.json', "r") as f:
        FULL_SPECS = json.loads(f.read())

    for spec in FULL_SPECS:
        if spec['id'] in embedding_ids:
            # embedding already in cache! move on!
            pass
        else:
            spec_str = spec_prompt(spec)  # type: ignore
            resp = openai.Embedding.create(input=spec_str, model="text-embedding-ada-002")
            print(resp["usage"]["total_tokens"])
            vector = resp["data"][0]["embedding"]
            embeddings.append(
                {
                    "id": spec["id"],
                    "name": spec['context'] + '.' + spec['name'],
                    "vector": vector,
                }
            )

    with open("embedding_cache.json", "w") as f:
        f.write(json.dumps(embeddings))

    most_similar_name = ""
    max_similarity = -2.0  # similarity is -1 to 1
    for embedding in embeddings:
        embedding["similarity"] = cosine_similarity(query_vector, embedding['vector'])
        if embedding["similarity"] > max_similarity:
            most_similar_name = embedding["name"]
            max_similarity = embedding["similarity"]

    embeddings = sorted(embeddings, key=lambda x: x['similarity'], reverse=True)

    print(question, ":")
    print(most_similar_name)
    print()

    for embedding in embeddings:
        print("{0},{1:.2f}".format(embedding['name'], embedding['similarity']))


# data format
# {
#   "data": [
#     {
#       "embedding": [
#         -0.0108,
#         -0.0107,
#         0.0323,
#         ...
#         -0.0114
#       ],
#       "index": 0,
#       "object": "embedding"
#     }
#   ],
#   "model": "text-embedding-ada-002",
#   "object": "list"
# }
