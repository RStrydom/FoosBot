'use strict'

import apiai from 'apiai'
import Botkit from 'botkit'
import { XmlEntities as Entities } from 'html-entities'
import uuid from 'node-uuid'
import { apiAiAccessToken, slackBotKey } from './secrets'

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
  debug: false,
  json_file_store: 'slackbot_storage'
  // include "log: false" to disable logging
})

let bot = controller.spawn({
  token: slackBotKey
}).startRTM()

// Foos vars
let numberOfSpots = 4
let playersInGame = []
let gameInProgress = false

function isDefined (obj) {
  if (typeof obj === 'undefined') {
    return false
  }

  if (!obj) {
    return false
  }

  return obj !== null
}

function sendMessage (message, messageText) {
  try {
    bot.reply(message, messageText)
  } catch (err) {
    bot.reply(message, err.message)
  }
}

// Listen for direction messages and all mentions @foos-bot
controller.hears(['.*'], ['direct_message', 'direct_mention', 'mention',], (bot, message) => {
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

            if (action === 'start_game' || action === 'join_current_game') {
              // start a new game if there isn't one in progress
              if (!gameInProgress) {
                gameInProgress = true
                numberOfSpots = 3
                playersInGame = []
                sendMessage(message, responseText)

                // Add the person who sent the message to the game
                bot.api.users.info({user: message.user}, (error, response) => {
                  playersInGame.push(response.user.name)
                })

                // Start the timer - games only last 5 mins
                setTimeout(function () {
                  // let users know that time is running out
                  if (numberOfSpots > 0) {
                    sendMessage(message, '30 seconds to go and we need ' + numberOfSpots + ' more players...')
                  }
                  // close game if its been 5 mins and we didn't get enough players
                  setTimeout(function () {
                    if (gameInProgress) {
                      gameInProgress = false
                      playersInGame = []
                      sendMessage(message, 'Game closed before we got enough players')
                    }
                  }, 30000)
                }, 270000)
              }
              // Join the current game if there is one in progress
              else {
                bot.api.users.info({user: message.user}, (error, response) => {
                  if (error) {
                    console.log(error)
                  }
                  // Don't let a user join the same game twice
                  if (arrayContains(response.user.name, playersInGame)) {
                    sendMessage(message, 'You are already in the game. You can\'t join twice.')
                  } else {
                    numberOfSpots--
                    playersInGame.push(response.user.name)
                    if (numberOfSpots > 1) {
                      sendMessage(message, numberOfSpots + ' more spots to go...')
                    } else if (numberOfSpots === 1) {
                      sendMessage(message, numberOfSpots + ' more spot to go! Ahhhhh!!!')
                    } else if (numberOfSpots === 0) {
                      sendMessage(message, 'Awesome! All spots are filled!')
                      gameInProgress = false
                      shuffle(playersInGame)
                      sendMessage(message, `Here is a random team assignment if you would like to use it? ${playersInGame[0]} & ${playersInGame[1]} VS ${playersInGame[2]} & ${playersInGame[3]}`)
                      // Save the number of games played to the local db
                      playersInGame.forEach((username) => {
                        updateNumberOfGamesPlayed(username)
                      })
                    }
                  }
                })
              }
            }

            // check the number of spots remaining
            else if (action === 'check_number_of_players_in_game') {
              sendMessage(message, 'There are ' + numberOfSpots + ' remaining...')
            } else if (action === 'get_help') {
              sendMessage(message, responseText)
            }

            else if (isDefined(responseData) && isDefined(responseData.slack)) {
              try {
                bot.reply(message, responseData.slack)
              } catch (err) {
                bot.reply(message, err.message)
              }
            } else if (isDefined(responseText)) {
              bot.reply(message, responseText, (err, resp) => {
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
 * Check if a string is in an array
 * @param string
 * @param array
 * @returns {boolean}
 */
function arrayContains (string, array) {
  return (array.indexOf(string) > -1)
}

/**
 * Returns the data about the number of games played for all users
 */
function getAllPlayersNumberOfGames () {
  controller.storage.users.all(function (error, allUserData) {
    if (error) {
      console.log(error)
    }
    return allUserData
  })
}
