'use strict'

import apiai from 'apiai'
import Botkit from 'botkit'
import { XmlEntities as Entities } from 'html-entities'
import uuid from 'node-uuid'
import { apiAiAccessToken, slackAppClientId, slackAppClientSecret } from './secrets'

const decoder = new Entities()

const devConfig = process.env.DEVELOPMENT_CONFIG === 'true'

const apiaiOptions = {}
if (devConfig) {
  apiaiOptions.hostname = process.env.DEVELOPMENT_HOST
  apiaiOptions.path = '/api/query'
}

const apiAiService = apiai(apiAiAccessToken, apiaiOptions)

const sessionIds = new Map()

const controller = Botkit.slackbot({
  debug: devConfig,
  json_file_store: __dirname + '/slackbot_storage'
}).configureSlackApp(
  {
    clientId: slackAppClientId,
    clientSecret: slackAppClientSecret,
    scopes: ['bot', 'commands']
  }
)

controller.setupWebserver(3000, (err, webserver) => {
  controller.createWebhookEndpoints(controller.webserver)
  controller.createOauthEndpoints(controller.webserver, function (err, req, res) {
    if (err) {
      res.status(500).send('ERROR: ' + err)
    } else {
      res.send('Success!')
    }
  })
})

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
let _bots = {}

function trackBot (bot) {
  _bots[bot.config.token] = bot
}

// Game variables
let numberOfSpots = 4
let playersInGame = []
let challengers = []
let numberOfChallengeSpots = 2
let gameInProgress = false
let edInsults = [
  '@edwardvincent Are you sure that is wise? :flushed:',
  '@edwardvincent Are you sure? :flushed:',
  '@edwardvincent Really?!! :flushed:',
  '@edwardvincent When will you learn? :flushed:',
  '@edwardvincent It just makes me sad :cry:'
]

controller.on('interactive_message_callback', function (bot, message) {
  let reply
  bot.api.users.info({user: message.user}, (error, response) => {
    let {name} = response.user
    if (message.actions[0].name === 'join') {
      if (arrayContains(name, playersInGame) && !devConfig) {
        bot.reply(message, `@${name} You are already in the game. You can't join twice. :no_entry_sign:`)
      } else {
        updateNumberOfGamesPlayed(name)
        if (name === 'edwardvincent') {
          let randomInsultIndex = Math.floor(Math.random() * edInsults.length)
          bot.reply(message, edInsults[randomInsultIndex])
        }
        let responseMessage = ''

        numberOfSpots--
        playersInGame.push(name)
        if (numberOfSpots > 1) {
          responseMessage = `${numberOfSpots} more spots to go... :timer_clock: @${name} - joined`
        } else if (numberOfSpots === 1) {
          responseMessage = `${numberOfSpots} more spot to go! Ahhhhh!!! :scream_cat: @${name} - joined`
        } else {
          responseMessage = `:no_good: too slow! :turtle:`
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
            text: `${playersInGame[0]} ${playersInGame[1]} ${playersInGame[2] ? playersInGame[2] : ''}`,
            color: '#4942ff'
          }]
        }

        if (numberOfSpots === 0) {
          bot.reply(message, `Let's go already! :bender:`)
          shuffle(playersInGame)
          reply = {
            text: 'Awesome! All spots are filled! :+1:',
            attachments: [{
              title: 'Who won?',
              text: `:foos: Black: @${playersInGame[0]} & @${playersInGame[1]}\n:vs:\n:foos: White: @${playersInGame[2]} & @${playersInGame[3]}`,
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
              }]
            }]
          }
        }
      }
    } else if (message.actions[0].name === 'black_won' || message.actions[0].name === 'white_won') {
      if (message.actions[0].name === 'black_won') {
        updateNumberOfWins(playersInGame[0])
        updateNumberOfWins(playersInGame[1])
        reply = {
          text: `Congrats ${playersInGame[0]} & ${playersInGame[1]}`,
          attachments: []
        }
      } else {
        updateNumberOfWins(playersInGame[2])
        updateNumberOfWins(playersInGame[3])
        reply = {
          text: `Congrats ${playersInGame[2]} & ${playersInGame[3]}`,
          attachments: []
        }
      }

      // Clear the game
      gameInProgress = false
      playersInGame = []
    } else {
      numberOfChallengeSpots--
      challengers.push(name)
      reply = {
        text: `Challengers:  @${name} ${challengers[0] ? challengers[0] : ''}`,
        attachments: [{
          title: 'Who won?',
          text: `Here is a random team assignment if you would like to use it?\n:foos: Black: @${playersInGame[0]} & @${playersInGame[1]}\n:vs:\n:foos: White: @${playersInGame[2]} & @${playersInGame[3]}`,
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
          }]
        }]
      }
    }

    if (numberOfChallengeSpots > 0) {
      reply.actions.push({
        'name': 'challenge',
        'style': 'primary',
        'text': `Challenge`,
        'value': '1',
        'type': 'button'
      })
    }

    bot.replyInteractive(message, reply)
  })
})

controller.on('create_bot', (bot, config) => {
  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function (err) {
      if (!err) {
        trackBot(bot)
      }

      bot.startPrivateConversation({user: config.createdBy}, function (err, convo) {
        if (err) {
          console.log(err)
        } else {
          convo.say('I am a bot that has just joined your team')
          convo.say('You must now /invite me to a channel so that I can be of use!')
        }
      })
    })
  }
})

// Handle events related to the websocket connection to Slack
controller.on('rtm_open', bot => {
  console.log('** The RTM api just connected!')
})

controller.on('rtm_close', bot => {
  console.log('** The RTM api just closed')
  // you may want to attempt to re-open
})

controller.storage.teams.all((err, teams) => {
  if (err) {
    throw new Error(err)
  }

  // connect all teams with bots up to slack!
  for (let t in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function (err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:', err)
        } else {
          trackBot(bot)
        }
      })
    }
  }
})

/**
 * Check if defined pollyfil
 * @param obj
 * @returns {boolean}
 */
function isDefined (obj) {
  if (typeof obj === 'undefined') {
    return false
  }

  if (!obj) {
    return false
  }

  return obj !== null
}

/**
 * Listen for direction messages and all mentions @foos-bot
 * Fire off the correct functions based on the type of request that was made
 */
controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  try {
    if (message.type === 'message') {
      if (message.user === bot.identity.id) {
        // message from bot can be skipped
      } else if (message.text.indexOf('<@U') === 0 && message.text.indexOf(bot.identity.id) === -1) {
        // skip other users direct mentions
      } else {
        let requestText = decoder.decode(message.text)
        requestText = requestText.replace('’', '\'')

        let channel = message.channel
        let botId = '<@' + bot.identity.id + '>'
        let userId = message.user

        if (requestText.indexOf(botId) > -1) {
          requestText = requestText.replace(botId, '')
        }

        if (!sessionIds.has(channel)) {
          sessionIds.set(channel, uuid.v1())
        }

        let request = apiAiService.textRequest(requestText,
          {
            sessionId: sessionIds.get(channel),
            contexts: [
              {
                name: 'generic',
                parameters: {
                  slack_user_id: userId,
                  slack_channel: channel
                }
              }
            ]
          })

        request.on('response', (response) => {
          if (isDefined(response.result)) {
            let responseText = response.result.fulfillment.speech
            let responseData = response.result.fulfillment.data
            let action = response.result.action

            if (action === 'start_game' || action === 'join_game') {
              startGame(bot, message)
            } else if (action === 'show_leaderboard') { // show who has played the most games
              showLeaderboard(bot, message, responseText)
            } else if (action === 'check_number_of_players_in_game') { // check the number of spots remaining
              if (!gameInProgress) {
                bot.reply(message, 'There is no game in progress - so 4 spots')
              } else {
                bot.reply(message, 'There are ' + numberOfSpots + ' remaining...')
              }
            } else if (action === 'get_help') {
              bot.reply(message, responseText)
            } else if (isDefined(responseData) && isDefined(responseData.slack)) {
              try {
                bot.reply(message, responseData.slack)
              } catch (err) {
                bot.reply(err.message)
              }
            } else if (isDefined(responseText)) {
              bot.reply(responseText, (err, resp) => {
                if (err) {
                  console.error(err)
                }
              })
            }
          }
        })

        request.on('error', (error) => console.error(error))
        request.end()
      }
    }
  } catch
    (err) {
    console.error(err)
  }
})

controller.on('slash_command', (bot, message) => {
  if (message.command === '/new-foos') {
    bot.replyPrivate(message, 'Starting game...')
    startGame(bot, message)
  } else if (message.command === '/clear-all-foos') {
    bot.replyPrivate(message, 'Clearing all games...')
    gameInProgress = false
    numberOfSpots = 4
    numberOfChallengeSpots = 2
    playersInGame = []
    challengers = []
  }
})

/**
 * Starts a new game
 * @param bot
 * @param message
 */
function startGame (bot, message) {
  // If there is a game in progress don't start a new one
  if (gameInProgress) {
    return bot.reply(message, 'There is already a game in progress -  please join that one')
  }
  gameInProgress = true
  numberOfSpots = 3
  numberOfChallengeSpots = 2
  playersInGame = []
  challengers = []

  bot.api.users.info({user: message.user}, (error, response) => {
    let reply = {
      text: `New game created by  @${response.user.name} :tada:`,
      attachments: [{
        title: 'Click to join while there is space!',
        callback_id: message.user,
        attachment_type: 'default',
        color: '#09b600',
        actions: [
          {
            'name': 'join',
            'style': 'primary',
            'text': ':tada: Join',
            'value': '1',
            'type': 'button'
          }
        ]
      }]
    }

    bot.reply(message, reply)

    // Add the person who sent the message to the game
    playersInGame.push(response.user.name)
    updateNumberOfGamesPlayed(response.user.name)
  })
}

/**
 * Fetches the stats around number of games played, sorts it and returns it as a message
 * @param bot
 * @param message
 */
function showLeaderboard (bot, message) {
  controller.storage.users.all((error, allUserData) => {
    if (error) {
      console.log(error)
    }
    let leaderboardMessage = ''
    let sortedUserArray = sortByKey(allUserData, 'numberOfGamesPlayed')
    sortedUserArray.map((user, index) => {
      leaderboardMessage += `${index + 1}) ${user.id} *${user.numberOfGamesPlayed}* \n`
    })
    bot.reply(message, leaderboardMessage)
  })
}

/**
 * Shuffles an array
 * @param array
 * @returns {*}
 */
function shuffle (array) {
  let currentIndex = array.length
  let temporaryValue
  let randomIndex

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1

    // And swap it with the current element.
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex]
    array[randomIndex] = temporaryValue
  }

  return array
}

/**
 * Saves the number of games played to a local db
 * @param username
 */
function updateNumberOfGamesPlayed (username) {
  controller.storage.users.get(username, function (error, userData) {
    if (error) {
      console.log(error)
    }
    if (userData) {
      controller.storage.users.save({
        id: username,
        numberOfGamesPlayed: (parseInt(userData.numberOfGamesPlayed, 10) + 1).toString()
      }, function (err) {
        if (err) {
          console.log(err, 'user data not saved')
        }
      })
    } else {
      controller.storage.users.save({id: username, numberOfGamesPlayed: 1}, function (err) {
        if (err) {
          console.log(err, 'user data not saved')
        }
      })
    }
  })
}

/**
 * Saves the number of games played to a local db
 * @param username
 */
function updateNumberOfWins (username) {
  controller.storage.users.get(username, (error, userData) => {
    if (error) {
      console.log(error)
    }
    if (userData) {
      controller.storage.users.save({
        id: username,
        numberOfWins: (parseInt(userData.numberOfWins, 10) + 1).toString()
      }, function (err) {
        if (err) {
          console.log(err, 'user data not saved')
        }
      })
    } else {
      controller.storage.users.save({id: username, numberOfWins: 1}, function (err) {
        if (err) {
          console.log(err, 'user data not saved')
        }
      })
    }
  })
}

/**
 * Check if a string is in an array
 * @param string
 * @param array
 * @returns {boolean}
 */
function arrayContains (string, array) {
  return (array.indexOf(string) > -1)
}

/**
 * Sort array (leaderboard) by key
 * @param array
 * @param key
 * @returns {Array.<T>}
 */
function sortByKey (array, key) {
  return array.sort(function (a, b) {
    let x = parseInt(a[key])
    let y = parseInt(b[key])
    return ((x > y) ? -1 : ((x < y) ? 1 : 0))
  })
}
