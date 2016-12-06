# SovTech Slack Foos Bot

A simple bot for letting others know that you would like to play foosball

### How to setup?

Get a slack bot api token from [Slack](https://slack.com/services/new/bot)

Get a api.ai token from [api.ai](https://api.ai)

Rename secrets.dummy.js to secrets.js and enter your tokens.

Run `npm i` to install the dependencies

Install foreverJS globally `npm install forever -g`

Run with `forever start dist/index.js`

Stop with `forever stop dist/index.js` or `forever stopall`

### How to use?

Send "@foos-bot help" to see a list of commands available