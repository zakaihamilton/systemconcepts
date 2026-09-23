export interface ResearchTagMetadata {
	title?: string;
	_id?: string;
	[key: string]: unknown;
}

export interface ResearchLibraryTag extends ResearchTagMetadata {
	_id: string;
	path?: string;
}

export interface ResearchSession {
	name?: string;
	group?: string;
	year?: string | number;
	date?: string;
	type?: string;
	description?: string;
	summaryText?: string;
	summary?: string | { path?: string } | null;
	[key: string]: unknown;
}

export interface ResearchMatch {
	index: number;
	text: string;
}

export interface ResearchDocument {
	docId?: string;
	isSession?: boolean;
	group?: string;
	year?: string | number;
	date?: string;
	type?: string;
	name?: string;
	description?: string;
	summary?: string | { path?: string } | null;
	summaryText?: string;
	summaryUnknown?: boolean;
	tag?: ResearchTagMetadata;
	paragraphs?: string[];
	matches?: Array<Partial<ResearchMatch>>;
	[key: string]: unknown;
}

export interface ResearchResult extends ResearchDocument {
	docId: string;
	matches: ResearchMatch[];
	customTags?: Array<{ label: string; value: string | number | undefined }>;
}

export type ResearchFilter =
	| string
	| {
			id?: string;
			type?: string;
			label?: string;
	  };

export type ResearchTranslations = Record<string, string | undefined>;

type ResearchTokenReferences = string[] | number[] | null | undefined;

/** Decoded legacy JSON and binary indexes supported by the Research search. */
export interface ResearchSearchIndex {
	v: number;
	f?: string[];
	d?: string[][] | Record<number, string[]>;
	t?: Record<string, ResearchTokenReferences>;
	files?: Record<string, ResearchDocument>;
	tokens?: Record<string, ResearchTokenReferences>;
}

export interface ResearchSearchOutcome {
	results: ResearchResult[];
	highlight: string[];
	cancelled?: boolean;
}

export interface ResearchQueryClause {
	raw?: string;
	terms: string[];
	phrase: boolean;
}

export type ResearchSuggestion =
	| {
			kind: "title" | "term";
			label: string | null;
			value: string;
	  }
	| {
			kind: "filter";
			label: string | undefined;
			value?: string;
			filter: ResearchFilter;
	  };
