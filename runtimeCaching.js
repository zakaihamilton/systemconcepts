"use strict";

module.exports = [
	{
		urlPattern: /\/api\/sessions(?:\?.*)?$/i,
		handler: "StaleWhileRevalidate",
		options: {
			cacheName: "stable-api-assets",
			expiration: {
				maxEntries: 128,
				maxAgeSeconds: 24 * 60 * 60, // 24 hours
			},
		},
	},
	{
		urlPattern:
			/\/api\/(?:aws|wasabi)\?.*(?:path=sessions%2F|path=%2Fsessions%2F)/i,
		handler: "StaleWhileRevalidate",
		options: {
			cacheName: "stable-session-files",
			expiration: {
				maxEntries: 256,
				maxAgeSeconds: 24 * 60 * 60, // 24 hours
			},
		},
	},
];
