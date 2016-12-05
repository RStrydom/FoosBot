import {TOKEN} from "./secrets";
import Bot from "slackbots";

// create a bot
const settings = {
    token: TOKEN,
    name: 'FoosBot'
};

const bot = new Bot(settings);

// give him a face
const params = {
    icon_emoji: ':robot_face:'
};

// define group or channel that we are posting to
const channelOrGroup = 'channel';
const postOrGroupName = 'general';

// game vars
let numberOfSpots = 4;
let playersInGame = [];
let gameInProgress = false;

// function to send a message to either a group (private channel) or a channel
function sendMessage(messageText) {
    if (channelOrGroup === 'channel') {
        bot.postMessageToChannel(postOrGroupName, messageText, params);
    }
    else {
        bot.postMessageToGroup(postOrGroupName, messageText, params);
    }
}

bot.on('message', function (data) {
    // all ingoing events https://api.slack.com/rtm
    //console.log(data);

    // check that the message has text
    if (data.text) {
        // start a new game if there isn't one in progress
        if (data.text.toUpperCase().startsWith('<@U3A62AGH4> I WANT TO FOOS')) {
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
                sendMessage('Alright! Lets go! The next 3 players to reply "@foos-bot in" will be in the next game.. Fastest foosers first!');
            } else {
                sendMessage('Sorry there is already a game in progress.. Join that one or wait 5 minutes for it to expire..');
            }
        }

        // join an existing game
        else if (data.text.toUpperCase().startsWith('<@U3A62AGH4> IN')) {
            console.log('user joining game...');
            if (gameInProgress) {
                if (numberOfSpots >= 0) {
                    numberOfSpots--;
                }
                if (numberOfSpots > 1) {
                    sendMessage(numberOfSpots + ' more spots to go...');
                }
                else if (numberOfSpots === 1) {
                    sendMessage(numberOfSpots + ' more spot to go! Ahhhhh!!!');
                }
                else if (numberOfSpots === 0) {
                    sendMessage('Awesome! All spots are filled!');
                    gameInProgress = false;
                }
                else if (numberOfSpots < 0) {
                    sendMessage('Sorry you are too late but don\'t worry about it - its only natural selection.');
                }
            }
            else {
                sendMessage('There is no game in progress at the moment. You can send "@foos-bot I want to foos!" to start a new game...');
            }
        }

        // check the number of spots remaining
        else if (data.text.toUpperCase().startsWith("<@U3A62AGH4> HOW MANY SPOTS")) {
            sendMessage('There are ' + numberOfSpots + ' remaining...');
        }

        // get help
        else if (data.text.toUpperCase().startsWith('<@U3A62AGH4> HELP')) {
            sendMessage('Hi there! I\'m foosbot.\nMy job is pretty simple. Just say \'@foos-bot I want to foos!\' and I\'ll create a new game for you. The user that sent the message will be player 1 and the next 3 to reply \'@foos-bot I\'m in\' will get a place in the game. Games expire after 5 minutes.\n Send \'@foos-bot how many spots?\' to see the number of places remaining in the current game.');
        }

        // let the user know that the message was rx'd but foos-bot didn't know what to do with it
        else if (data.text.toUpperCase().startsWith('<@U3A62AGH4>')) {
            sendMessage('huh? send \'@foos-bot help\' to see what I can do');
        }
    }
});
