/**
 * Injects Cordova content into the application's index.html
 */
'use strict';

const filter = require('gulp-filter');
const lazypipe = require('lazypipe');
const replace = require('gulp-replace');
const size = require('gulp-size');
const fs = require('fs');

const DEFAULT_SOURCE = 'index.html';

const injectionFilePath = require.resolve('./index.html.inject');

/**
 * Replaces placeholder in the index.html of the Cordova application
 * 
 * @param {Object} options Configuration for the replacement
 * @param {string[]} options.connectSrc Entries to be added to the CSP rule for "connect-src"
 * @param {string[]} options.defaultSrc Entries to be added to the CSP rule for "default-src"
 * @param {string[]} options.frameSrc Entries to be added to the CSP rule for "frame-src"
 * @param {string} options.source Path of the application, e.g. index.html (or http://localhost:post for iOS)
 */
module.exports = function injectIndex({ connectSrc, defaultSrc, frameSrc, source = DEFAULT_SOURCE } = options) {
	const htmlFilter = filter('**/*.html', {restore: true});

	return lazypipe()
		.pipe(() => htmlFilter)
		.pipe(() => injectDeviceReadyDetection(injectionFilePath)())
		.pipe(() => replace(/<base\ *href=".*"\ *>/, ''))
		.pipe(() => replace('<!-- inject:cordova-script -->', '<script src="cordova.js" async></script>'))
		.pipe(() => replace('<!-- inject:cordova-csp -->', createMetaCsp(source, connectSrc, defaultSrc, frameSrc)))
		.pipe(() => size({title: 'inject-cordova-index'}))
		.pipe(() => htmlFilter.restore);
}

// HTML Injection
function injectDeviceReadyDetection(injectionFilePath) {
  const textToInject = extractTextToInject(injectionFilePath);
  return lazypipe()
    .pipe(() => replace(/<head>/, `<head>${textToInject.headStart}`))
    .pipe(() => replace(/<\/head>/, `${textToInject.headEnd}</head>`))
    .pipe(() => replace(/<body>/, `<body>${textToInject.bodyStart}`))
    .pipe(() => replace(/<\/body>/, `${textToInject.bodyEnd}</body>`))
    .pipe(() => size({ title: "inject-cordova-trigger" }));
}

function extractTextToInject(injectionFilePath) {
	const injectionText = String(fs.readFileSync(injectionFilePath));
	if (!injectionText) {
		throw new Error(
      `File ${injectionFilePath} not found !`
    );
	}
  const headStart = /<head-start>([\s\S]*)<\/head-start>/.exec(injectionText);
  const headEnd = /<head-end>([\s\S]*)<\/head-end>/.exec(injectionText);
  const bodyStart = /<body-start>([\s\S]*)<\/body-start>/.exec(injectionText);
  const bodyEnd = /<body-end>([\s\S]*)<\/body-end>/.exec(injectionText);
  // const headEnd = injectionText.match(/<head-end>([\s\S]*)<\/head-end>/g);
  if (!headStart || !headEnd || !bodyStart || !bodyEnd) {
    throw new Error(
      `Bad injection file. Required patterns do no match (<head-end>/<body-start>/<body-end> !!!! Please ensure to use a well formatted injextion file (here we use: '${
        injectionFilePath
      }')`
    );
  }
  return {
    headStart: headStart[1],
    headEnd: headEnd[1],
    bodyStart: bodyStart[1],
    bodyEnd: bodyEnd[1]
  };
}

/**
 * Creates the <meta> tag for the Content-Security-Policy
 * 
 * It enables by default access to Youtube, Google Analytics, and Google fonts.
 * 
 * @return {string} Meta tag with CSP rules
 */
function createMetaCsp(source, connectSrc = [], defaultSrc = [], frameSrc = []) {
	const cspConnectSrc = [
		'self:',
		source === DEFAULT_SOURCE ? 'file:' : source,
		...connectSrc
	];

	// Allow playing embeded Youtube videos
	const cspDefaultSrc = [
		'https://www.google-analytics.com',
		'https://www.youtube.com',
		'https://s.ytimg.com',
		...defaultSrc,
	];
	const cspFrameSrc = [
		'https://www.youtube.com',
		...frameSrc
	];

	const cspRules = {
		'default-src': `'self' data: gap: https://ssl.gstatic.com 'unsafe-eval' 'unsafe-inline' ${cspDefaultSrc.join(' ')}`,
		'media-src': 'data: *',
		'img-src': 'data: blob: *',
		'font-src': 'data: \'self\' https://fonts.gstatic.com',
		'style-src': '\'self\' \'unsafe-inline\' https://fonts.googleapis.com',
		'connect-src': cspConnectSrc.join(' '),
		'frame-src': cspFrameSrc.join(' '),
		'child-src': cspFrameSrc.join(' '),
	};

	const csp = Object.keys(cspRules)
		.map(key => `${key} ${cspRules[key]}`)
		.join(';');
	return `<meta http-equiv="Content-Security-Policy" content="${csp}"/>`;
}
