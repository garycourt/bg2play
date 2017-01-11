//
// Dependencies
//
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t;
    return { next: verb(0), "throw": verb(1), "return": verb(2) };
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
var gulp = require("gulp");
var node_fetch_1 = require("node-fetch");
var URI = require('uri-js');
var querystring = require("querystring");
var fs = require("fs");
var promisify_1 = require("./promisify");
var writeFileAsync = promisify_1.promisify(fs.writeFile);
var readFileAsync = promisify_1.promisify(fs.readFile);
var sax = require("sax");
var _ = require("lodash");
var dateFns = require("date-fns");
var git = require('simple-git')();
git.commitAsync = promisify_1.promisify(git.commit);
git.commitAsync = promisify_1.promisify(git.commit);
git.pushAsync = promisify_1.promisify(git.push);
//
// Configs
//
var USERNAME = 'garycourt';
var BGG_API_URL = 'https://boardgamegeek.com/xmlapi2/';
function games2PlayToHtml(games) {
    var now = new Date();
    return "\n<html>\n<head>\n\t<link href=\"style.css\" rel=\"stylesheet\"/>\n</head>\n<body>\n\t<h1>Gary's Board Games to Play Next</h1>\n\t<table>\n\t\t<thead>\n\t\t\t<tr>\n\t\t\t\t<td></td>\n\t\t\t\t<td>Game</td>\n\t\t\t\t<td>Last Played</td>\n\t\t\t</tr>\n\t\t</thead>\n\t\t<tbody>" + games.map(function (game) { return "\n\t\t\t\t<tr>\n\t\t\t\t\t<td><img src=\"http:" + game.thumbnail + "\"></td>\n\t\t\t\t\t<td><a href=\"https://boardgamegeek.com/boardgame/" + game.id + "\" target=\"boardgame\">" + game.name + "</a></td>\n\t\t\t\t\t<td><abbr class=\"" + (game.wanttoplay ? 'want-to-play' : '') + " " + (game.lastplayed && new Date(game.lastplayed) < dateFns.subYears(now, 1) ? 'overdue' : '') + "\" title=\"" + (game.lastplayed || '') + "\">" + (game.wanttoplay ? 'WANT TO PLAY' : (game.lastplayed ? dateFns.distanceInWords(now, game.lastplayed, { addSuffix: true }) : 'NEW GAME')) + "</abbr></td>\n\t\t\t\t</tr>\n\t\t"; }).join('') + "</tbody>\n\t</table>\n</body>\n</html>\n\t";
}
//
// Methods
//
function serializeBggUrl(command, args) {
    var urlObj = URI.parse(BGG_API_URL);
    urlObj.path += command;
    urlObj.query = querystring.stringify(args);
    return URI.serialize(urlObj);
}
function delay(time) {
    return new Promise(function (fulfill) {
        setTimeout(fulfill, time);
    });
}
function checkIfCollectionReady(retryFunc, response) {
    if (response.status === 202) {
        console.log("Data not ready; retrying...");
        return delay(3000).then(retryFunc);
    }
    return Promise.resolve(response);
}
function fetchGameCollection() {
    var url = serializeBggUrl('collection', {
        'username': USERNAME,
        'version': 1,
        'excludesubtype': 'boardgameexpansion',
        'brief': 0,
        'stats': 1,
        'own': 1,
        'prevowned': 0,
        'trade': 0
    });
    return node_fetch_1.default(url).then(checkIfCollectionReady.bind(null, fetchGameCollection));
}
function fetchExpansionCollection() {
    var url = serializeBggUrl('collection', {
        'username': USERNAME,
        'version': 1,
        'subtype': 'boardgameexpansion',
        'brief': 0,
        'stats': 1,
        'own': 1,
        'prevowned': 0,
        'trade': 0
    });
    return node_fetch_1.default(url).then(checkIfCollectionReady.bind(null, fetchExpansionCollection));
}
function fetchPlays(page) {
    if (page === void 0) { page = 1; }
    var url = serializeBggUrl('plays', {
        'username': USERNAME,
        'page': page
    });
    return node_fetch_1.default(url);
}
function fetchAllPlays() {
    return __awaiter(this, void 0, void 0, function () {
        var totalPages, allPagesXml, page, response, xml;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    totalPages = 1;
                    allPagesXml = [];
                    page = 1;
                    _a.label = 1;
                case 1:
                    if (!(page <= totalPages))
                        return [3 /*break*/, 5];
                    return [4 /*yield*/, fetchPlays(page)];
                case 2:
                    response = _a.sent();
                    return [4 /*yield*/, response.text()];
                case 3:
                    xml = _a.sent();
                    allPagesXml.push(xml);
                    if (totalPages === 1) {
                        totalPages = parseTotalPages(xml);
                    }
                    _a.label = 4;
                case 4:
                    ++page;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/, allPagesXml.join('')];
            }
        });
    });
}
function saveResponse(filename, response) {
    return response.buffer().then(function (buffer) { return writeFileAsync(filename, buffer); });
}
function parseTotalPages(xml) {
    var parser = sax.parser(true, { trim: true });
    var totalPages = 0;
    parser.onopentag = function (node) {
        if (node.name === 'plays') {
            totalPages = Math.ceil(parseInt(String(node.attributes['total']), 10) / 100) || 1;
        }
    };
    parser.write(xml).close();
    return totalPages;
}
function parsePlays(xml) {
    var playthroughs = [];
    var parser = sax.parser(true, { trim: true });
    var play = undefined;
    parser.onopentag = function (node) {
        if (node.name === 'play') {
            play = {
                id: String(node.attributes['id']),
                date: String(node.attributes['date']),
                game: undefined
            };
        }
        else if (node.name === 'item' && play) {
            play.game = {
                id: String(node.attributes['objectid']),
                name: String(node.attributes['name'])
            };
        }
    };
    parser.onclosetag = function (name) {
        if (name === 'play') {
            if (play && play.id && play.date && play.game)
                playthroughs.push(play);
            play = undefined;
        }
    };
    parser.write(xml).close();
    return playthroughs;
}
function parseGames(xml) {
    var boardgames = [];
    var parser = sax.parser(true, { trim: true });
    var game = undefined;
    var nextText = undefined;
    parser.onopentag = function (node) {
        if (node.name === 'item' && !game && node.attributes['subtype'] === 'boardgame') {
            game = {
                id: String(node.attributes['objectid']),
                name: undefined,
                thumbnail: undefined,
                lastmodified: undefined,
                wanttoplay: undefined
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
    };
    parser.onclosetag = function (name) {
        if (name === 'item' && game) {
            if (game.id && game.name) {
                boardgames.push(game);
            }
            game = undefined;
        }
    };
    parser.write(xml).close();
    return boardgames;
}
function compareStrings(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return +1;
    return 0;
}
function rankGames(games, plays) {
    //Apply `lastplayed` to each game
    plays.forEach(function (play) {
        //HACK: Apply Imperial Assault expansion playthroughs to the Imperial Assault game
        var playGameId = (play.game.name && /^Star Wars: Imperial Assault/.test(play.game.name) ? '164153' : play.game.id);
        var game = _.find(games, { id: playGameId });
        if (game && (!game.lastplayed || game.lastplayed < play.date)) {
            game.lastplayed = play.date;
        }
    });
    //HACK: Patch old listings
    games.forEach(function (game) {
        if (!game.lastplayed && game.lastmodified < '2016-01-01') {
            game.lastplayed = '2016-01-01';
        }
    });
    var now = dateFns.format(new Date(), 'YYYY-MM-DD');
    //Sort games
    return games.slice().sort(function (a, b) {
        if (a.wanttoplay !== b.wanttoplay) {
            return (a.wanttoplay ? +1 : -1);
        }
        else if (!a.lastplayed && !b.lastplayed) {
            return -1 * compareStrings(a.lastmodified || now, b.lastmodified || now);
        }
        else if (!a.lastplayed) {
            return +1;
        }
        else if (!b.lastplayed) {
            return -1;
        }
        else {
            return -1 * compareStrings(a.lastplayed, b.lastplayed);
        }
    }).reverse();
}
function games2Play() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, collectionXml, playsXml, games, plays;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([readFileAsync('games.xml', 'utf8'), readFileAsync('plays.xml', 'utf8')])];
                case 1:
                    _a = _b.sent(), collectionXml = _a[0], playsXml = _a[1];
                    games = parseGames(collectionXml);
                    plays = parsePlays(playsXml);
                    return [2 /*return*/, rankGames(games, plays)];
            }
        });
    });
}
function publish() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, git.commitAsync('Generated on ' + (new Date()).toString(), ['index.html'])];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, git.pushAsync('origin', 'master')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
//
// Tasks
//
gulp.task('fetch', ['fetch:games', 'fetch:plays']);
gulp.task('fetch:games', function () {
    console.log('Fetching game collection...');
    return fetchGameCollection()
        .then(saveResponse.bind(null, 'games.xml'));
});
gulp.task('fetch:expansions', function () {
    console.log('Fetching expansion collection...');
    return fetchExpansionCollection()
        .then(saveResponse.bind(null, 'expansions.xml'));
});
gulp.task('fetch:plays', function () { return __awaiter(_this, void 0, void 0, function () {
    var totalPages, allPagesXml, page, response, xml;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                totalPages = 1;
                allPagesXml = '';
                page = 1;
                _a.label = 1;
            case 1:
                if (!(page <= totalPages))
                    return [3 /*break*/, 5];
                console.log('Fetching plays, page ' + page + '...');
                return [4 /*yield*/, fetchPlays(page)];
            case 2:
                response = _a.sent();
                return [4 /*yield*/, response.text()];
            case 3:
                xml = _a.sent();
                allPagesXml += xml;
                if (totalPages === 1) {
                    totalPages = parseTotalPages(xml);
                }
                _a.label = 4;
            case 4:
                ++page;
                return [3 /*break*/, 1];
            case 5: return [2 /*return*/, writeFileAsync('plays.xml', allPagesXml)];
        }
    });
}); });
gulp.task('parse:plays', function () {
    return readFileAsync('plays.xml', 'utf8').then(function (xml) { return parsePlays(xml); }).then(function (json) { return console.log(json); });
});
gulp.task('parse:games', function () {
    return readFileAsync('games.xml', 'utf8').then(function (xml) { return parseGames(xml); }).then(function (json) { return console.log(json); });
});
gulp.task('rank', function () {
    return games2Play().then(function (games2Play) { return console.log(games2Play); });
});
gulp.task('generate', function () {
    return games2Play().then(games2PlayToHtml).then(function (html) { return writeFileAsync('index.html', html); });
});
gulp.task('publish', function () {
    return publish();
});
gulp.task('default', function () { return __awaiter(_this, void 0, void 0, function () {
    var _a, gamesXml, playsXml, rankedGames, rankedGamesHtml;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log('Fetching data...');
                return [4 /*yield*/, Promise.all([
                        fetchGameCollection().then(function (resp) { return resp.text(); }),
                        fetchAllPlays()
                    ])];
            case 1:
                _a = _b.sent(), gamesXml = _a[0], playsXml = _a[1];
                console.log('Saving data...');
                return [4 /*yield*/, Promise.all([writeFileAsync('games.xml', gamesXml), writeFileAsync('plays.xml', playsXml)])];
            case 2:
                _b.sent();
                console.log('Generating webpage...');
                rankedGames = rankGames(parseGames(gamesXml), parsePlays(playsXml));
                rankedGamesHtml = games2PlayToHtml(rankedGames);
                return [4 /*yield*/, writeFileAsync('index.html', rankedGamesHtml)];
            case 3:
                _b.sent();
                console.log('Publishing...');
                return [2 /*return*/, publish()];
        }
    });
}); });
