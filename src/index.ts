//
// Dependencies
//

import * as gulp from 'gulp';
import fetch, {Response} from 'node-fetch';
const URI = require('uri-js');
import * as querystring from 'querystring';
import * as fs from 'fs';
import {promisify} from './promisify';
const writeFileAsync = promisify<string, Buffer|string, void>(fs.writeFile);
const readFileAsync = promisify<string, string, string>(fs.readFile);
import * as sax from 'sax';
import * as _ from 'lodash';
import * as dateFns from 'date-fns';
const git = require('simple-git')();
git.commitAsync = promisify<string, Array<string>, void>(git.commit);
git.commitAsync = promisify<string, Array<string>, void>(git.commit);
git.pushAsync = promisify<string, string, void>(git.push);

//
// Configs
//

const USERNAME = 'garycourt';
const BGG_API_URL = 'https://boardgamegeek.com/xmlapi2/';

function games2PlayToHtml(games:Array<Boardgame>):string {
	const now = new Date();
	return `
<html>
<head>
	<link href="style.css" rel="stylesheet"/>
</head>
<body>
	<h1>Gary's Board Games to Play Next</h1>
	<table>
		<thead>
			<tr>
				<td></td>
				<td>Game</td>
				<td>Last Played</td>
			</tr>
		</thead>
		<tbody>${games.map(game => `
				<tr>
					<td><img src="http:${game.thumbnail}"></td>
					<td><a href="https://boardgamegeek.com/boardgame/${game.id}" target="boardgame">${game.name}</a></td>
					<td><abbr class="${game.wanttoplay ? 'want-to-play' : ''} ${game.lastplayed && new Date(game.lastplayed) < dateFns.subYears(now, 1) ? 'overdue' : ''}" title="${game.lastplayed || ''}">${game.wanttoplay ? 'WANT TO PLAY' : (game.lastplayed ? dateFns.distanceInWords(now, game.lastplayed, {addSuffix: true}) : 'NEW GAME')}</abbr></td>
				</tr>
		`).join('')}</tbody>
	</table>
</body>
</html>
	`;
}

//
// Interfaces
//

interface URIComponents {
	scheme?:string,
	userinfo?:string,
	host?:string,
	port?:number|string,
	path?:string,
	query?:string,
	fragment?:string,
	reference?:string,
	error?:string
}

interface BoardgameReference {
	id : string,
	name? : string
}

interface Boardgame extends BoardgameReference {
	name : string,
	thumbnail? : string,
	lastmodified? : string,
	wanttoplay? : boolean,
	lastplayed? : string
}

interface Playthrough {
	id : string,
	date : string,
	game : BoardgameReference
}

//
// Methods
//

function serializeBggUrl(command:string, args:Object):string {
	const urlObj = <URIComponents>URI.parse(BGG_API_URL);
	urlObj.path += command;
	urlObj.query = querystring.stringify(args);
	return URI.serialize(urlObj);
}

function delay(time:number):Promise<void> {
  return new Promise<void>(function (fulfill) {
    setTimeout(fulfill, time);
  });
}

function checkIfCollectionReady(retryFunc:()=>Promise<Response>, response:Response):Promise<Response> {
	if (response.status === 202) {
		console.log("Data not ready; retrying...");
		return delay(3000).then(retryFunc);
	}

	return Promise.resolve(response);
}

function fetchGameCollection():Promise<Response> {
	const url = serializeBggUrl('collection', {
		'username' : USERNAME,
		'version' : 1,
		'excludesubtype' : 'boardgameexpansion',
		'brief' : 0,
		'stats' : 1,
		'own' : 1,
		'prevowned' : 0,
		'trade' : 0
	});

	return fetch(url).then(checkIfCollectionReady.bind(null, fetchGameCollection));
}

function fetchExpansionCollection():Promise<Response> {
	const url = serializeBggUrl('collection', {
		'username' : USERNAME,
		'version' : 1,
		'subtype' : 'boardgameexpansion',
		'brief' : 0,
		'stats' : 1,
		'own' : 1,
		'prevowned' : 0,
		'trade' : 0
	});

	return fetch(url).then(checkIfCollectionReady.bind(null, fetchExpansionCollection));
}

function fetchPlays(page:number = 1):Promise<Response> {
	const url = serializeBggUrl('plays', {
		'username' : USERNAME,
		'page' : page
	});

	return fetch(url);
}

async function fetchAllPlays():Promise<string> {
	let totalPages = 1;
	const allPagesXml:Array<string> = [];

	for (let page = 1; page <= totalPages; ++page) {
		const response = await fetchPlays(page);
		const xml = await response.text();
		allPagesXml.push(xml);
		if (totalPages === 1) {
			totalPages = parseTotalPages(xml);
		}
	}

	return allPagesXml.join('');
}

function saveResponse(filename:string, response:Response):Promise<void> {
	return response.buffer().then(buffer => writeFileAsync(filename, buffer));
}

function parseTotalPages(xml:string):number {
	const parser = sax.parser(true, {trim:true});
	let totalPages:number = 0;

	parser.onopentag = function (node) {
		if (node.name === 'plays') {
			totalPages = Math.ceil(parseInt(String(node.attributes['total']), 10) / 100) || 1;
		}
	};

	parser.write(xml).close();

	return totalPages;
}

function parsePlays(xml:string):Array<Playthrough> {
	const playthroughs:Array<Playthrough> = [];
	const parser = sax.parser(true, {trim:true});
	let play:Partial<Playthrough>|undefined = undefined;

	parser.onopentag = function (node) {
		if (node.name === 'play') {
			play = {
				id : String(node.attributes['id']),
				date : String(node.attributes['date']),
				game : undefined
			};
		} else if (node.name === 'item' && play) {
			play.game = {
				id : String(node.attributes['objectid']),
				name : String(node.attributes['name'])
			};
		}
	};

	parser.onclosetag = function (name) {
		if (name === 'play') {
			if (play && play.id && play.date && play.game) playthroughs.push(<Playthrough>play);
			play = undefined;
		}
	}

	parser.write(xml).close();

	return playthroughs;
}

function parseGames(xml:string):Array<Boardgame> {
	const boardgames:Array<Boardgame> = [];
	const parser = sax.parser(true, {trim:true});
	let game:Partial<Boardgame>|undefined = undefined;
	let nextText:string|undefined = undefined;

	parser.onopentag = function (node) {
		if (node.name === 'item' && !game && node.attributes['subtype'] === 'boardgame') {
			game = {
				id : String(node.attributes['objectid']),
				name : undefined,
				thumbnail : undefined,
				lastmodified : undefined,
				wanttoplay : undefined
			};
		}

		if ((node.name === 'name' || node.name === 'thumbnail') && game) {
			nextText = node.name;
		}

		if (node.name === 'status' && game) {
			game.lastmodified = String(node.attributes['lastmodified']);
			game.wanttoplay = String(node.attributes['wanttoplay']) === '1';
		}
	};

	parser.ontext = function (text) {
		if (nextText && game) {
			game[nextText] = String(text);
			nextText = undefined;
		}
	}

	parser.onclosetag = function (name) {
		if (name === 'item' && game) {
			if (game.id && game.name) {
				boardgames.push(<Boardgame>game);
			}
			game = undefined;
		}
	}

	parser.write(xml).close();

	return boardgames;
}

function compareStrings(a:string, b:string):number {
	if (a < b) return -1;
	if (a > b) return +1;
	return 0;
}

function rankGames(games:Array<Boardgame>, plays:Array<Playthrough>):Array<Boardgame> {
	//Apply `lastplayed` to each game
	plays.forEach((play) => {
		//HACK: Apply Imperial Assault expansion playthroughs to the Imperial Assault game
		const playGameId = (play.game.name && /^Star Wars: Imperial Assault/.test(play.game.name) ? '164153' : play.game.id);
		const game = _.find(games, {id : playGameId});
		if (game && (!game.lastplayed || game.lastplayed < play.date)) {
			game.lastplayed = play.date;
		}
	});

	//HACK: Patch old listings
	games.forEach((game) => {
		if (!game.lastplayed && game.lastmodified < '2016-01-01') {
			game.lastplayed = '2016-01-01';
		}
	});

	const now = dateFns.format(new Date(), 'YYYY-MM-DD');

	//Sort games
	return games.slice().sort((a, b) => {
		if (a.wanttoplay !== b.wanttoplay) {
			return (a.wanttoplay ? +1 : -1);
		} else if (!a.lastplayed && !b.lastplayed) {
			return -1 * compareStrings(a.lastmodified || now, b.lastmodified || now);
		} else if (!a.lastplayed) {
			return +1;
		} else if (!b.lastplayed) {
			return -1;
		} else {
			return -1 * compareStrings(a.lastplayed, b.lastplayed);
		}
	}).reverse();
}

async function games2Play():Promise<Array<Boardgame>> {
	const [collectionXml, playsXml] = await Promise.all([readFileAsync('games.xml', 'utf8'), readFileAsync('plays.xml', 'utf8')]);
	const games = parseGames(collectionXml);
	const plays = parsePlays(playsXml);
	return rankGames(games, plays);
}

async function publish():Promise<void> {
	await git.commitAsync('Generated on ' + (new Date()).toString(), ['index.html']);
	await git.pushAsync('origin', 'master');
}

//
// Tasks
//

gulp.task('fetch', ['fetch:games', 'fetch:plays']);

gulp.task('fetch:games', () => {
	console.log('Fetching game collection...');
	return fetchGameCollection()
		.then(saveResponse.bind(null, 'games.xml'))
	;
});

gulp.task('fetch:expansions', () => {
	console.log('Fetching expansion collection...');
	return fetchExpansionCollection()
		.then(saveResponse.bind(null, 'expansions.xml'))
	;
});

gulp.task('fetch:plays', async () => {
	// return fetchPlays()
	// 	.then(saveResponse.bind(null, 'plays.xml'))
	// ;

	let totalPages = 1;
	let allPagesXml:string = '';

	for (let page = 1; page <= totalPages; ++page) {
		console.log('Fetching plays, page ' + page + '...');
		const response = await fetchPlays(page);
		const xml = await response.text();
		allPagesXml += xml;
		if (totalPages === 1) {
			totalPages = parseTotalPages(xml);
		}
	}

	return writeFileAsync('plays.xml', allPagesXml);
});

gulp.task('parse:plays', () => {
	return readFileAsync('plays.xml', 'utf8').then(xml => parsePlays(xml)).then(json => console.log(json));
});

gulp.task('parse:games', () => {
	return readFileAsync('games.xml', 'utf8').then(xml => parseGames(xml)).then(json => console.log(json));
});

gulp.task('rank', () => {
	return games2Play().then(games2Play => console.log(games2Play));
});

gulp.task('generate', () => {
	return games2Play().then(games2PlayToHtml).then(html => writeFileAsync('index.html', html));
});

gulp.task('publish', () => {
	return publish();
});

gulp.task('default', async () => {
	console.log('Fetching data...');
	const [gamesXml, playsXml] = await Promise.all([
		fetchGameCollection().then(resp => resp.text()),
		fetchAllPlays()
	]);

	console.log('Saving data...');
	await Promise.all([writeFileAsync('games.xml', gamesXml), writeFileAsync('plays.xml', playsXml)])

	console.log('Generating webpage...');
	const rankedGames = rankGames(parseGames(gamesXml), parsePlays(playsXml));
	const rankedGamesHtml = games2PlayToHtml(rankedGames);
	await writeFileAsync('index.html', rankedGamesHtml);

	console.log('Publishing...');
	return publish();
});
