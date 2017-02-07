'use strict';

var _botkit = require("botkit");

var _botkit2 = _interopRequireDefault(_botkit);

var _apiai = require("apiai");

var _apiai2 = _interopRequireDefault(_apiai);

var _nodeUuid = require("node-uuid");

var _nodeUuid2 = _interopRequireDefault(_nodeUuid);

var _htmlEntities = require("html-entities");

var _secrets = require("./secrets");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var decoder = new _htmlEntities.XmlEntities();

var devConfig = process.env.DEVELOPMENT_CONFIG == 'true';

var apiaiOptions = {};
if (devConfig) {
    apiaiOptions.hostname = process.env.DEVELOPMENT_HOST;
    apiaiOptions.path = "/api/query";
}

var apiAiService = (0, _apiai2.default)(_secrets.apiAiAccessToken, apiaiOptions);

var sessionIds = new Map();

var controller = _botkit2.default.slackbot({
    debug: false
    //include "log: false" to disable logging
});

var bot = controller.spawn({
    token: _secrets.slackBotKey
}).startRTM();

// Foos vars
var numberOfSpots = 4;
var playersInGame = [];
var gameInProgress = false;

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

function sendMessage(message, message_text) {
    try {
        bot.reply(message, message_text);
    } catch (err) {
        bot.reply(message, err.message);
    }
}

// Listen for direction messages and all mentions @foos-bot
controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
    try {
        if (message.type == 'message') {
            if (message.user == bot.identity.id) {
                // message from bot can be skipped
            } else if (message.text.indexOf("<@U") == 0 && message.text.indexOf(bot.identity.id) == -1) {
                // skip other users direct mentions
            } else {

                var requestText = decoder.decode(message.text);
                requestText = requestText.replace("’", "'");

                var channel = message.channel;
                var messageType = message.event;
                var botId = '<@' + bot.identity.id + '>';
                var userId = message.user;

                if (requestText.indexOf(botId) > -1) {
                    requestText = requestText.replace(botId, '');
                }

                if (!sessionIds.has(channel)) {
                    sessionIds.set(channel, _nodeUuid2.default.v1());
                }

                var request = apiAiService.textRequest(requestText, {
                    sessionId: sessionIds.get(channel),
                    contexts: [{
                        name: "generic",
                        parameters: {
                            slack_user_id: userId,
                            slack_channel: channel
                        }
                    }]
                });

                request.on('response', function (response) {

                    if (isDefined(response.result)) {
                        var responseText = response.result.fulfillment.speech;
                        var responseData = response.result.fulfillment.data;
                        var action = response.result.action;

                        if (action === "start_game" || action === "join_current_game") {
                            // start a new game if there isn't one in progress
                            if (!gameInProgress) {
                                setTimeout(function () {
                                    // let users know that time is running out
                                    if (numberOfSpots > 0) {
                                        sendMessage('30 seconds to go and we need ' + numberOfSpots + ' more players...');
                                    }
                                    // close game if its been 5 mins and we didn't get enough players
                                    setTimeout(function () {
                                        if (gameInProgress) {
                                            gameInProgress = false;
                                            sendMessage('Game closed before we got enough players');
                                        }
                                    }, 30000);
                                }, 270000);
                                gameInProgress = true;
                                numberOfSpots = 3;
                                sendMessage(message, responseText);

                                // Add the person who sent the message to the game
                                bot.api.users.info({ user: message.user }, function (error, response) {
                                    playersInGame.push(response.user.name);
                                });
                            } else {
                                if (numberOfSpots >= 0) {
                                    numberOfSpots--;
                                    // Add the person who sent the message to the game
                                    bot.api.users.info({ user: message.user }, function (error, response) {
                                        playersInGame.push(response.user.name);
                                        if (numberOfSpots === 0) {
                                            shuffle(playersInGame);
                                            sendMessage(message, "Here is a random team assignment if you would like to use it? " + playersInGame[0] + " & " + playersInGame[1] + " VS " + playersInGame[2] + " & " + playersInGame[3]);
                                        }
                                    });
                                }
                                if (numberOfSpots > 1) {
                                    sendMessage(message, numberOfSpots + ' more spots to go...');
                                } else if (numberOfSpots === 1) {
                                    sendMessage(message, numberOfSpots + ' more spot to go! Ahhhhh!!!');
                                } else if (numberOfSpots === 0) {
                                    sendMessage(message, 'Awesome! All spots are filled!');
                                    gameInProgress = false;
                                } else if (numberOfSpots < 0) {
                                    sendMessage(message, 'Sorry you are too late but don\'t worry about it - its only natural selection.');
                                }
                            }
                        }

                        // check the number of spots remaining
                        else if (action === "check_number_of_players_in_game") {
                                sendMessage(message, 'There are ' + numberOfSpots + ' remaining...');
                            }

                            // get help
                            else if (action === "get_help") {
                                    sendMessage(message, responseData.slack);
                                } else if (isDefined(responseData) && isDefined(responseData.slack)) {
                                    try {
                                        bot.reply(message, responseData.slack);
                                    } catch (err) {
                                        bot.reply(message, err.message);
                                    }
                                } else if (isDefined(responseText)) {
                                    bot.reply(message, responseText, function (err, resp) {
                                        if (err) {}
                                    });
                                }
                    }
                });

                request.on('error', function (error) {
                    return;
                });
                request.end();
            }
        }
    } catch (err) {}
});

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue = void 0,
        randomIndex = void 0;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
//# sourceMappingURL=index.js.map