'use strict';

var _apiai = require('apiai');

var _apiai2 = _interopRequireDefault(_apiai);

var _botkit = require('botkit');

var _botkit2 = _interopRequireDefault(_botkit);

var _htmlEntities = require('html-entities');

var _nodeUuid = require('node-uuid');

var _nodeUuid2 = _interopRequireDefault(_nodeUuid);

var _secrets = require('./secrets');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
  debug: devConfig,
  json_file_store: './slackbot_storage'
}).configureSlackApp({
  clientId: _secrets.slackAppClientId,
  clientSecret: _secrets.slackAppClientSecret,
  scopes: ['bot', 'commands']
});

controller.setupWebserver(3000, function (err, webserver) {
  controller.createWebhookEndpoints(controller.webserver);
  controller.createOauthEndpoints(controller.webserver, function (err, req, res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Success!');
    }
  });
}

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
);var _bots = {};

function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

// Game variables
var numberOfSpots = 4;
var playersInGame = [];
var challengers = [];
var numberOfChallengeSpots = 2;
var gameInProgress = false;
var edInsults = ['@edwardvincent Are you sure that is wise? :flushed:', '@edwardvincent Are you sure? :flushed:', '@edwardvincent Really?!! :flushed:', '@edwardvincent When will you learn? :flushed:', '@edwardvincent It just makes me sad :cry:'];

controller.on('interactive_message_callback', function (bot, message) {
  var reply = void 0;
  bot.api.users.info({ user: message.user }, function (error, response) {
    var name = response.user.name;

    if (arrayContains(name, playersInGame) && !devConfig) {
      bot.reply(message, '@' + name + ' You are already in the game. You can\'t join twice. :no_entry_sign:');
    } else {
      updateNumberOfGamesPlayed(name);
      if (name === 'edwardvincent') {
        var randomInsultIndex = Math.floor(Math.random() * edInsults.length);
        bot.reply(message, edInsults[randomInsultIndex]);
      }

      if (message.actions[0].name === 'join') {
        var responseMessage = '';

        numberOfSpots--;
        playersInGame.push(name);
        if (numberOfSpots > 1) {
          responseMessage = numberOfSpots + ' more spots to go... :timer_clock: @' + name + ' - joined';
        } else if (numberOfSpots === 1) {
          responseMessage = numberOfSpots + ' more spot to go! Ahhhhh!!! :scream_cat: @' + name + ' - joined';
        } else {
          responseMessage = ':no_good: too slow! :turtle:';
        }

        reply = {
          text: responseMessage,
          attachments: [{
            title: 'Click to join while there is space!',
            callback_id: message.user,
            attachment_type: 'default',
            color: '#09b600',
            actions: [{
              'name': 'join',
              'style': 'primary',
              'text': ':tada: Join',
              'value': '1',
              'type': 'button'
            }]
          }, {
            title: 'Players in the game:',
            text: playersInGame[0] + ' ' + playersInGame[1] + ' ' + (playersInGame[2] ? playersInGame[2] : ''),
            color: '#4942ff'
          }]
        };

        if (numberOfSpots === 0) {
          shuffle(playersInGame);
          reply = {
            text: 'Awesome! All spots are filled! :+1:',
            attachments: [{
              title: 'Who won?',
              text: ':foos: Black: @' + playersInGame[0] + ' & @' + playersInGame[1] + '\n\n              :vs:\n\n              :foos: White: @' + playersInGame[2] + ' & @' + playersInGame[3],
              callback_id: message.user,
              attachment_type: 'default',
              color: '#09b600',
              actions: [{
                'name': 'black_won',
                'style': 'primary',
                'text': 'Black won',
                'value': '1',
                'type': 'button'
              }, {
                'name': 'white_won',
                'style': 'primary',
                'text': 'White won',
                'value': '1',
                'type': 'button'
              }, {
                'name': 'challenge',
                'style': 'primary',
                'text': 'Challenge',
                'value': '1',
                'type': 'button'
              }]
            }]
          };
        }
      } else if (message.actions[0].name === 'black_won' || message.actions[0].name === 'white_won') {
        if (message.actions[0].name === 'black_won') {
          updateNumberOfWins(playersInGame[0]);
          updateNumberOfWins(playersInGame[1]);
          reply = {
            text: 'Congrats ' + playersInGame[0] + ' & ' + playersInGame[1],
            attachments: []
          };
        } else {
          updateNumberOfWins(playersInGame[2]);
          updateNumberOfWins(playersInGame[3]);
          reply = {
            text: 'Congrats ' + playersInGame[2] + ' & ' + playersInGame[3],
            attachments: []
          };
        }

        // Clear the game
        gameInProgress = false;
        playersInGame = [];
      } else {
        numberOfChallengeSpots--;
        challengers.push(name);
        reply = {
          text: 'Challenge  @' + name + ' - challenged',
          attachments: [{
            title: 'Who won?',
            text: 'Here is a random team assignment if you would like to use it?\n\n          :foos: Black: @' + playersInGame[0] + ' & @' + playersInGame[1] + '\n\n          :vs:\n\n          :foos: White: @' + playersInGame[2] + ' & @' + playersInGame[3],
            callback_id: message.user,
            attachment_type: 'default',
            color: '#09b600',
            actions: [{
              'name': 'join',
              'style': 'primary',
              'text': 'Black won',
              'value': '1',
              'type': 'button'
            }, {
              'name': 'join',
              'style': 'primary',
              'text': 'White won',
              'value': '1',
              'type': 'button'
            }, {
              'name': 'challenge',
              'style': 'primary',
              'text': 'Challenge',
              'value': '2',
              'type': 'button'
            }]
          }]
        };
      }

      bot.replyInteractive(message, reply);
    }
  });
});

controller.on('create_bot', function (bot, config) {
  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function (err) {
      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({ user: config.createdBy }, function (err, convo) {
        if (err) {} else {
          convo.say('I am a bot that has just joined your team');
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });
    });
  }
}

// Handle events related to the websocket connection to Slack
);controller.on('rtm_open', function (bot) {});

controller.on('rtm_close', function (bot) {});

controller.storage.teams.all(function (err, teams) {
  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function (err, bot) {
        if (err) {} else {
          trackBot(bot);
        }
      });
    }
  }
}

/**
 * Check if defined pollyfil
 * @param obj
 * @returns {boolean}
 */
);function isDefined(obj) {
  if (typeof obj === 'undefined') {
    return false;
  }

  if (!obj) {
    return false;
  }

  return obj !== null;
}

/**
 * Listen for direction messages and all mentions @foos-bot
 * Fire off the correct functions based on the type of request that was made
 */
controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
  try {
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

            if (action === 'start_game' || action === 'join_game') {
              startGame(bot, message);
            } else if (action === 'show_leaderboard') {
              // show who has played the most games
              showLeaderboard(bot, message, responseText);
            } else if (action === 'check_number_of_players_in_game') {
              // check the number of spots remaining
              if (!gameInProgress) {
                bot.reply(message, 'There is no game in progress - so 4 spots');
              } else {
                bot.reply(message, 'There are ' + numberOfSpots + ' remaining...');
              }
            } else if (action === 'get_help') {
              bot.reply(message, responseText);
            } else if (isDefined(responseData) && isDefined(responseData.slack)) {
              try {
                bot.reply(message, responseData.slack);
              } catch (err) {
                bot.reply(err.message);
              }
            } else if (isDefined(responseText)) {
              bot.reply(responseText, function (err, resp) {
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

controller.on('slash_command', function (bot, message) {
  if (message.command === '/new-foos') {
    startGame(bot, message);
  } else if (message.command === '/clear-all-foos') {
    gameInProgress = false;
    numberOfSpots = 4;
    numberOfChallengeSpots = 2;
    playersInGame = [];
    challengers = [];
  }
}

/**
 * Starts a new game
 * @param bot
 * @param message
 */
);function startGame(bot, message) {
  // If there is a game in progress don't start a new one
  if (gameInProgress) {
    return bot.reply(message, 'There is already a game in progress -  please join that one');
  }
  gameInProgress = true;
  numberOfSpots = 3;
  numberOfChallengeSpots = 2;
  playersInGame = [];
  challengers = [];

  bot.api.users.info({ user: message.user }, function (error, response) {
    var reply = {
      text: 'New game created by  @' + response.user.name + ' :tada:',
      attachments: [{
        title: 'Click to join while there is space!',
        callback_id: message.user,
        attachment_type: 'default',
        color: '#09b600',
        actions: [{
          'name': 'join',
          'style': 'primary',
          'text': ':tada: Join',
          'value': '1',
          'type': 'button'
        }]
      }]
    };

    bot.reply(message, reply

    // Add the person who sent the message to the game
    );playersInGame.push(response.user.name);
    updateNumberOfGamesPlayed(response.user.name);
  });
}

/**
 * Fetches the stats around number of games played, sorts it and returns it as a message
 * @param bot
 * @param message
 */
function showLeaderboard(bot, message) {
  controller.storage.users.all(function (error, allUserData) {
    if (error) {}
    var leaderboardMessage = '';
    var sortedUserArray = sortByKey(allUserData, 'numberOfGamesPlayed');
    sortedUserArray.map(function (user, index) {
      leaderboardMessage += index + 1 + ') ' + user.id + ' *' + user.numberOfGamesPlayed + '* \n';
    });
    bot.reply(message, leaderboardMessage);
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
 * Saves the number of games played to a local db
 * @param username
 */
function updateNumberOfWins(username) {
  controller.storage.users.get(username, function (error, userData) {
    if (error) {}
    if (userData) {
      controller.storage.users.save({
        id: username,
        numberOfWins: (parseInt(userData.numberOfWins, 10) + 1).toString()
      }, function (err) {
        if (err) {}
      });
    } else {
      controller.storage.users.save({ id: username, numberOfWins: 1 }, function (err) {
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
//# sourceMappingURL=index.js.map