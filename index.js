let secrets = require('./secrets');

let Bot = require('slackbots');

// create a bot
let settings = {
    token: secrets.token,
    name: 'FoosBot'
};
let bot = new Bot(settings);

let params = {
    icon_emoji: ':robot_face:'
};

let channelOrGroup = 'channel';
let postOrGroupName = 'general';

let numberOfSpots = 4;
let playersInGame = [];
let gameInProgress = false;

function sendMessage(messageText) {
    if (channelOrGroup === 'channel') {
        bot.postMessageToChannel(postOrGroupName, messageText, params)
    }
    else {
        bot.postMessageToGroup(postOrGroupName, messageText, params)
    }
}

bot.on('message', function (data) {
    // all ingoing events https://api.slack.com/rtm
    console.log(data);

    // start a new game
    if (data.text.toUpperCase().startsWith("<@U3A62AGH4> I WANT TO FOOS")) {
        if (!gameInProgress) {
            setTimeout(function () {
                if (numberOfSpots > 0) {
                    sendMessage('30 seconds to go and we need ' + numberOfSpots + ' more players...');
                }
                setTimeout(function () {
                    gameInProgress = false;
                    sendMessage('Game expired...')
                }, 30000);
            }, 90000);
            gameInProgress = true;
            numberOfSpots = 3;
            sendMessage('Alright! Lets go! The next 3 players to reply "@foos-bot in" will be in the next game.. Fastest foosers first!')
        } else {
            sendMessage('Sorry there is already a game in progress.. Join that one or wait 2 minutes for it to expire..')
        }
    }

    // join an existing game
    else if (data.text.toUpperCase().startsWith("<@U3A62AGH4> IN")) {
        console.log('user joining game...');
        console.log('number of spots remaining: ', numberOfSpots);
        if (gameInProgress) {
            if (numberOfSpots >= 0) {
                numberOfSpots--;
            }
            if (numberOfSpots > 1) {
                sendMessage(numberOfSpots + ' more spots to go...')
            }
            else if (numberOfSpots === 1) {
                sendMessage(numberOfSpots + ' more spot to go! Ahhhhh!!!')
            }
            else if (numberOfSpots === 0) {
                sendMessage('Awesome! All spots are filled!')
            }
            else if (numberOfSpots < 0) {
                sendMessage('Sorry you are too late but don\'t worry about it - its only natural selection.')
            }
        }
        else {
            sendMessage('There is no game in progress at the moment. You can send "@foos-bot I want to foos!" to start a new game...')
        }
    }

    // check the number of spots remaining
    else if (data.text.toUpperCase().startsWith("<@U3A62AGH4> HOW MANY SPOTS")) {
        sendMessage("There are " + numberOfSpots + " remaining...")
    }

    // get help
    else if (data.text.toUpperCase().startsWith("<@U3A62AGH4> HELP")) {
        sendMessage("Hi there! I'm foosbot.\nMy job is pretty simple. Just say '@foos-bot I want to foos!' and I'll create a new game for you. The user that sent the message will be player 1 and the next 3 to reply '@foos-bot I'm in' will get a place in the game. Games expire after 2 minutes.\n Send '@foos-bot how many spots?' to see the number of places remaining in the current game.",
        )
    }

    // ping
    else if (data.text.toUpperCase().startsWith("<@U3A62AGH4>")) {
        sendMessage("huh?")
    }
});
