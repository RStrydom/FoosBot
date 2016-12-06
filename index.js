'use strict';

import Botkit from "botkit";
import apiai from "apiai";
import uuid from "node-uuid";
import {XmlEntities as Entities} from "html-entities";
import {apiAiAccessToken, slackBotKey} from './secrets'

const decoder = new Entities();

const devConfig = process.env.DEVELOPMENT_CONFIG == 'true';

const apiaiOptions = {};
if (devConfig) {
    apiaiOptions.hostname = process.env.DEVELOPMENT_HOST;
    apiaiOptions.path = "/api/query";
}

const apiAiService = apiai(apiAiAccessToken, apiaiOptions);

const sessionIds = new Map();

const controller = Botkit.slackbot({
    debug: false
    //include "log: false" to disable logging
});

let bot = controller.spawn({
    token: slackBotKey
}).startRTM();

// Foos vars
let numberOfSpots = 4;
let playersInGame = [];
let gameInProgress = false;


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

controller.hears(['.*'], ['direct_message', 'direct_mention'], (bot, message) => {
    try {
        if (message.type == 'message') {
            if (message.user == bot.identity.id) {
                // message from bot can be skipped
            }
            else if (message.text.indexOf("<@U") == 0 && message.text.indexOf(bot.identity.id) == -1) {
                // skip other users direct mentions
            }
            else {

                let requestText = decoder.decode(message.text);
                requestText = requestText.replace("’", "'");

                let channel = message.channel;
                let messageType = message.event;
                let botId = '<@' + bot.identity.id + '>';
                let userId = message.user;

                console.log(requestText);
                console.log(messageType);

                if (requestText.indexOf(botId) > -1) {
                    requestText = requestText.replace(botId, '');
                }

                if (!sessionIds.has(channel)) {
                    sessionIds.set(channel, uuid.v1());
                }

                console.log('Start request ', requestText);
                let request = apiAiService.textRequest(requestText,
                    {
                        sessionId: sessionIds.get(channel),
                        contexts: [
                            {
                                name: "generic",
                                parameters: {
                                    slack_user_id: userId,
                                    slack_channel: channel
                                }
                            }
                        ]
                    });

                request.on('response', (response) => {
                    console.log(response);

                    if (isDefined(response.result)) {
                        let responseText = response.result.fulfillment.speech;
                        let responseData = response.result.fulfillment.data;
                        let action = response.result.action;

                        if (action === "start_game") {
                            // start a new game if there isn't one in progress
                            // check if there is a game running
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
                                sendMessage(message, 'Alright! Lets go! The next 3 players to reply "@foos-bot in" will be in the next game.. Fastest foosers first!');
                            } else {
                                sendMessage(message, 'Sorry there is already a game in progress.. Join that one or wait 5 minutes for it to expire..');
                            }
                        }

                        // join an existing game
                        else if (action === "join_current_game") {
                            if (gameInProgress) {
                                if (numberOfSpots >= 0) {
                                    numberOfSpots--;
                                }
                                if (numberOfSpots > 1) {
                                    sendMessage(message, numberOfSpots + ' more spots to go...');
                                }
                                else if (numberOfSpots === 1) {
                                    sendMessage(message, numberOfSpots + ' more spot to go! Ahhhhh!!!');
                                }
                                else if (numberOfSpots === 0) {
                                    sendMessage(message, 'Awesome! All spots are filled!');
                                    gameInProgress = false;
                                }
                                else if (numberOfSpots < 0) {
                                    sendMessage(message, 'Sorry you are too late but don\'t worry about it - its only natural selection.');
                                }
                            }
                            else {
                                sendMessage(message, 'There is no game in progress at the moment. You can send "@foos-bot I want to foos!" to start a new game...');
                            }
                        }

                        // check the number of spots remaining
                        else if (action === "check_number_of_players_in_game") {
                            sendMessage(message, 'There are ' + numberOfSpots + ' remaining...');
                        }

                        // get help
                        else if (action === "get_help") {
                            sendMessage(message, 'Hi there! I\'m foosbot.\nMy job is pretty simple. Just say \'@foos-bot I want to foos!\' and I\'ll create a new game for you. The user that sent the message will be player 1 and the next 3 to reply \'@foos-bot I\'m in\' will get a place in the game. Games expire after 5 minutes.\n Send \'@foos-bot how many spots?\' to see the number of places remaining in the current game.');
                        }

                        else if (isDefined(responseData) && isDefined(responseData.slack)) {
                            try {
                                bot.reply(message, responseData.slack);
                            } catch (err) {
                                bot.reply(message, err.message);
                            }
                        } else if (isDefined(responseText)) {
                            bot.reply(message, responseText, (err, resp) => {
                                if (err) {
                                    console.error(err);
                                }
                            });
                        }
                    }

                });

                request.on('error', (error) => console.error(error));
                request.end();
            }
        }
    } catch
        (err) {
        console.error(err);
    }
});
