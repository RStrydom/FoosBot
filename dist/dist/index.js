'use strict';

var _apiai = require('apiai');

var _apiai2 = _interopRequireDefault(_apiai);

var _botkit = require('botkit');

var _botkit2 = _interopRequireDefault(_botkit);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _htmlEntities = require('html-entities');

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _nodeUuid = require('node-uuid');

var _nodeUuid2 = _interopRequireDefault(_nodeUuid);

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

var _secrets = require('./secrets');

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

// start the web server
runWebServer();

var decoder = new _htmlEntities.XmlEntities();

var devConfig = process.env.DEVELOPMENT_CONFIG === 'true';

var apiaiOptions = {};
if (devConfig) {
  apiaiOptions.hostname = process.env.DEVELOPMENT_HOST;
  apiaiOptions.path = '/api/query';
}

var apiAiService = (0, _apiai2.default)(_secrets.apiAiAccessToken, apiaiOptions);

var sessionIds = new Map();

var controller = _botkit2.default.slackbot({
  debug: false,
  json_file_store: './slackbot_storage'
  // include "log: false" to disable logging
});

var bot = controller.spawn({
  token: _secrets.slackBotKey
}).startRTM();

// Game variables
var numberOfSpots = 4;
var playersInGame = [];
var numberOfChallengeSpots = 2;
var gameInProgress = false;
var edInsults = ['@edwardvincent Are you sure that is wise? :flushed:', '@edwardvincent Are you sure? :flushed:', '@edwardvincent Really?!! :flushed:', '@edwardvincent When will you learn? :flushed:', '@edwardvincent It just makes me sad :cry:'];

/**
 * Check if defined pollyfil
 * @param obj
 * @returns {boolean}
 */
function isDefined(obj) {
  if (typeof obj === 'undefined') {
    return false;
  }

  if (!obj) {
    return false;
  }

  return obj !== null;
}

/**
 * Generic function to send slack response
 * @param message - object to give the message context
 * @param messageText - text that will be sent
 */
function sendMessage(message, messageText) {
  try {
    bot.reply(message, messageText);
  } catch (err) {
    bot.reply(message, err.message);
  }
}

/**
 * Listen for direction messages and all mentions @foos-bot
 * Fire off the correct functions based on the type of request that was made
 */
controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
  try {
    var attachmentMessage = {
      attachments: [{
        title: 'Do you want to interact with my buttons?',
        callback_id: '123',
        attachment_type: 'default',
        actions: [{
          'name': 'yes',
          'text': 'Yes',
          'value': 'yes',
          'type': 'button'
        }, {
          'name': 'no',
          'text': 'No',
          'value': 'no',
          'type': 'button'
        }]
      }]
    };
    sendMessage(message, attachmentMessage);

    if (message.type === 'message') {
      if (message.user === bot.identity.id) {
        // message from bot can be skipped
      } else if (message.text.indexOf('<@U') === 0 && message.text.indexOf(bot.identity.id) === -1) {
        // skip other users direct mentions
      } else {
        var requestText = decoder.decode(message.text);
        requestText = requestText.replace('’', '\'');

        var channel = message.channel;
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
            name: 'generic',
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

            if (action === 'start_game' || action === 'join_current_game') {
              // start a new game if there isn't one in progress
              if (!gameInProgress) {
                startGame(message, responseText);
              } else {
                // Join the current game if there is one in progress
                joinGame(message, responseText);
              }
            } else if (action === 'challenge_winners') {
              // challenge the winners of the last game
              challengeWinners(message, responseText);
            } else if (action === 'show_leaderboard') {
              // show who has played the most games
              showLeaderboard(message, responseText);
            } else if (action === 'check_number_of_players_in_game') {
              // check the number of spots remaining
              sendMessage(message, 'There are ' + numberOfSpots + ' remaining...');
            } else if (action === 'get_help') {
              sendMessage(message, responseText);
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
          return void 0;
        });
        request.end();
      }
    }
  } catch (err) {}
});

/**
 * Starts a new game
 * @param message
 * @param responseText
 */
function startGame(message, responseText) {
  gameInProgress = true;
  numberOfSpots = 3;
  numberOfChallengeSpots = 2;
  playersInGame = [];
  sendMessage(message, responseText);

  // Add the person who sent the message to the game
  bot.api.users.info({ user: message.user }, function (error, response) {
    if (error) {}
    playersInGame.push(response.user.name);

    // If user is ed mock him a little
    if (response.user.name === 'edwardvincent') {
      var randomInsultIndex = Math.floor(Math.random() * edInsults.length);
      sendMessage(message, edInsults[randomInsultIndex]);
    }
  });

  // Start the timer - games only last 5 mins
  setTimeout(function () {
    // let users know that time is running out
    if (numberOfSpots > 0) {
      sendMessage(message, '30 seconds to go and we need ' + numberOfSpots + ' more players... :timer_clock: :timer_clock:');
    }
    // close game if its been 5 mins and we didn't get enough players
    setTimeout(function () {
      if (gameInProgress) {
        gameInProgress = false;
        playersInGame = [];
        sendMessage(message, 'Game closed before we got enough players :cry:');
      }
    }, 30000);
  }, 270000);
}

/**
 * Join an existing game
 * @param message
 * @param responseText
 */
function joinGame(message, responseText) {
  bot.api.users.info({ user: message.user }, function (error, response) {
    if (error) {}
    // Don't let a user join the same game twice
    if (arrayContains(response.user.name, playersInGame)) {
      sendMessage(message, 'You are already in the game. You can\'t join twice. :no_entry_sign:');
    } else {
      numberOfSpots--;
      playersInGame.push(response.user.name);
      if (numberOfSpots > 1) {
        sendMessage(message, numberOfSpots + ' more spots to go... :timer_clock:');
      } else if (numberOfSpots === 1) {
        sendMessage(message, numberOfSpots + ' more spot to go! Ahhhhh!!! :scream_cat:');
      } else if (numberOfSpots === 0) {
        sendMessage(message, 'Awesome! All spots are filled! :+1:');
        // Wait 30 seconds before allowing a new game to start so that we can catch users who were too slow
        setTimeout(function () {
          if (gameInProgress) {
            gameInProgress = false;
          }
        }, 30000);
        shuffle(playersInGame);
        sendMessage(message, 'Here is a random team assignment if you would like to use it?');
        sendMessage(message, ':foos: _' + playersInGame[0] + '_ *&* _' + playersInGame[1] + '_');
        sendMessage(message, ':vs:');
        sendMessage(message, ':foos: _' + playersInGame[2] + '_ *&* _' + playersInGame[3] + '_');
        // Save the number of games played to the local db
        playersInGame.forEach(function (username) {
          updateNumberOfGamesPlayed(username);
        });
      } else {
        sendMessage(message, ':no_good: too slow! :turtle:');
      }
    }
  });
}

/**
 * Challenge the winners of the current game
 * @param message
 * @param responseText
 */
function challengeWinners(message, responseText) {
  if (gameInProgress) {
    if (numberOfSpots !== 0) {
      sendMessage(message, 'There is still space in the current game. Please join that instead of trying to challenge.');
    } else if (numberOfChallengeSpots === 0) {
      sendMessage(message, 'Sorry, we already have 2 challengers');
    } else {
      numberOfChallengeSpots--;
      sendMessage(message, 'Ok great, you are in for the next game!');
    }
  } else {
    sendMessage(message, 'Sorry there is no game in progress for you to challenge. Please be faster next time. The ability to challenge expires 30 seconds after the game is full');
  }
}

/**
 * Fetches the stats around number of games played, sorts it and returns it as a message
 * @param message
 * @param responseText
 */
function showLeaderboard(message, responseText) {
  controller.storage.users.all(function (error, allUserData) {
    if (error) {}
    var leaderboardMessage = '';
    var sortedUserArray = sortByKey(allUserData, 'numberOfGamesPlayed');
    sortedUserArray.map(function (user, index) {
      leaderboardMessage += index + 1 + ') ' + user.id + ' *' + user.numberOfGamesPlayed + '* \n';
    });
    sendMessage(message, leaderboardMessage);
  });
}

/**
 * Shuffles an array
 * @param array
 * @returns {*}
 */
function shuffle(array) {
  var currentIndex = array.length;
  var temporaryValue = void 0;
  var randomIndex = void 0;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
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

/**
 * Saves the number of games played to a local db
 * @param username
 */
function updateNumberOfGamesPlayed(username) {
  controller.storage.users.get(username, function (error, userData) {
    if (error) {}
    if (userData) {
      controller.storage.users.save({
        id: username,
        numberOfGamesPlayed: (parseInt(userData.numberOfGamesPlayed, 10) + 1).toString()
      }, function (err) {
        if (err) {}
      });
    } else {
      controller.storage.users.save({ id: username, numberOfGamesPlayed: 1 }, function (err) {
        if (err) {}
      });
    }
  });
}

/**
 * Check if a string is in an array
 * @param string
 * @param array
 * @returns {boolean}
 */
function arrayContains(string, array) {
  return array.indexOf(string) > -1;
}

/**
 * Sort array (leaderboard) by key
 * @param array
 * @param key
 * @returns {Array.<T>}
 */
function sortByKey(array, key) {
  return array.sort(function (a, b) {
    var x = parseInt(a[key]);
    var y = parseInt(b[key]);
    return x > y ? -1 : x < y ? 1 : 0;
  });
}

function runWebServer() {
  var index = _fs2.default.readFileSync('index.html');

  _http2.default.createServer(function (request, response) {
    if (request.method === 'POST') {
      processPost(request, response, function () {
        // Use request.post here
        response.writeHead(200, 'OK', { 'Content-Type': 'text/plain' });
        response.end();
      });
    } else {
      response.writeHead(200, 'OK', { 'Content-Type': 'text/plain' });
      response.end(index);
    }
  }).listen(9615);
}

function processPost(request, response, callback) {
  var queryData = '';
  if (typeof callback !== 'function') return null;

  if (request.method === 'POST') {
    request.on('data', function (data) {
      queryData += data;
      if (queryData.length > 1e6) {
        queryData = '';
        response.writeHead(413, { 'Content-Type': 'text/plain' }).end();
        request.connection.destroy();
      }
    });

    request.on('end', function () {
      request.post = _querystring2.default.parse(queryData);
      callback();
    });
  } else {
    response.writeHead(405, { 'Content-Type': 'text/plain' });
    response.end();
  }
}
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map