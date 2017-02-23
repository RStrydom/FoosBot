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

// Listen for direction messages and all mentions @foos-bot
controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention',], (bot, message) => {
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
                                            playersInGame = [];
                                            sendMessage('Game closed before we got enough players');
                                        }
                                    }, 30000);
                                }, 270000);
                                gameInProgress = true;
                                numberOfSpots = 3;
                                playersInGame = [];
                                sendMessage(message, responseText);

                                // Add the person who sent the message to the game
                                bot.api.users.info({user: message.user}, (error, response) => {
                                    playersInGame.push(response.user.name);
                                });

                            } else {
                                if (numberOfSpots >= 0) {
                                    numberOfSpots--;
                                    // Add the person who sent the message to the game
                                    bot.api.users.info({user: message.user}, (error, response) => {
                                        playersInGame.push(response.user.name);
                                        if (numberOfSpots === 0) {
                                            shuffle(playersInGame);
                                            sendMessage(message, `Here is a random team assignment if you would like to use it? ${playersInGame[0]} & ${playersInGame[1]} VS ${playersInGame[2]} & ${playersInGame[3]}`);
                                        }
                                    });
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
                        }

                        // check the number of spots remaining
                        else if (action === "check_number_of_players_in_game") {
                            sendMessage(message, 'There are ' + numberOfSpots + ' remaining...');
                        }

                        // get help
                        else if (action === "get_help") {
                            sendMessage(message, responseData.slack);
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

function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

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