export interface ApiSection {
	id: string;
	label: string;
}

export interface QueryParamDoc {
	name: string;
	typeKey: string;
	typeDefault: string;
	descKey: string;
	descDefault: string;
}

export function getSessionsApiSections(translations: any): ApiSection[] {
	return [
		{
			id: "api-sessions-endpoint",
			label: translations.API_SECTION_ENDPOINT || "Endpoint",
		},
		{
			id: "api-sessions-parameters",
			label: translations.API_QUERY_PARAMETERS || "Query Parameters",
		},
		{
			id: "api-sessions-examples",
			label: translations.API_SECTION_EXAMPLES || "Examples",
		},
		{
			id: "api-sessions-schema",
			label: translations.API_JSON_RESPONSE_SCHEMA || "JSON Response Schema",
		},
	];
}

export const SESSIONS_QUERY_PARAMS: QueryParamDoc[] = [
	{
		name: "group",
		typeKey: "API_TYPE_STRING",
		typeDefault: "String",
		descKey: "API_PARAM_GROUP_DESC",
		descDefault: "Filter sessions by their specific group name.",
	},
	{
		name: "tag",
		typeKey: "API_TYPE_STRING",
		typeDefault: "String",
		descKey: "API_PARAM_TAG_DESC",
		descDefault: "Filter sessions containing a specific tag.",
	},
	{
		name: "date",
		typeKey: "API_TYPE_STRING",
		typeDefault: "String",
		descKey: "API_PARAM_DATE_DESC",
		descDefault: "Filter by exact date (format: YYYY-MM-DD).",
	},
	{
		name: "year",
		typeKey: "API_TYPE_STRING",
		typeDefault: "String",
		descKey: "API_PARAM_YEAR_DESC",
		descDefault: "Filter sessions by year.",
	},
	{
		name: "query",
		typeKey: "API_TYPE_STRING",
		typeDefault: "String",
		descKey: "API_PARAM_QUERY_DESC",
		descDefault: "Text search across title, synopsis, and tags.",
	},
	{
		name: "index",
		typeKey: "API_TYPE_INTEGER",
		typeDefault: "Integer",
		descKey: "API_PARAM_INDEX_DESC",
		descDefault: "Start index for pagination / sliding window (default: 0).",
	},
	{
		name: "count",
		typeKey: "API_TYPE_INTEGER",
		typeDefault: "Integer",
		descKey: "API_PARAM_COUNT_DESC",
		descDefault: "Limit results count (default: 100, max: 500).",
	},
];

export function buildSessionsCodeExamples(
	apiUrl: string,
): Record<string, string> {
	return {
		curl: `curl -X GET "${apiUrl}&group=american&index=0&count=5"`,
		fetch: `fetch("${apiUrl}&group=american&index=0&count=5")
  .then(response => response.json())
  .then(data => structuredLogger.debug(data))
  .catch(error => structuredLogger.error(error));`,
		python: `import requests

url = "${apiUrl}"
params = {
    "group": "american",
    "index": 0,
    "count": 5
}

response = requests.get(url, params=params)
if response.status_code == 200:
    sessions = response.json()
    for session in sessions:
        print(f"{session['date']} - {session['name']}")
else:
    print(f"Error: {response.status_code}")`,
	};
}

export const SESSIONS_RESPONSE_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SessionsResponse",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "Unique identifier of the session."
      },
      "group": {
        "type": "string",
        "description": "The group name the session belongs to."
      },
      "year": {
        "type": "string",
        "description": "The year of the session (YYYY)."
      },
      "date": {
        "type": "string",
        "format": "date",
        "description": "The exact date of the session (YYYY-MM-DD)."
      },
      "name": {
        "type": "string",
        "description": "The display name of the session."
      },
      "duration": {
        "type": "integer",
        "minimum": 0,
        "description": "The duration of the session in seconds."
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "List of tags associated with the session."
      },
      "summaryText": {
        "type": ["string", "null"],
        "description": "Detailed AI-generated summary of the session."
      },
      "audioUrl": {
        "type": ["string", "null"],
        "format": "uri",
        "description": "Temporary signed URL to the session audio; expires after 24 hours. Null when no audio asset is available."
      },
      "imageUrl": {
        "type": ["string", "null"],
        "format": "uri",
        "description": "S3-proxied secure URL to the image asset."
      },
      "transcriptionUrl": {
        "type": ["string", "null"],
        "format": "uri",
        "description": "S3-proxied secure URL to the raw text transcription file."
      }
    },
    "required": [
      "id",
      "group",
      "year",
      "date",
      "name",
      "duration",
      "tags",
      "summaryText",
      "audioUrl",
      "imageUrl",
      "transcriptionUrl"
    ]
  }
}`;
