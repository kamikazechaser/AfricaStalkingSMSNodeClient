var TelegramBot = require('node-telegram-bot-api');

module.exports = function(app) {
    // telegram bot

    var token = '149743120:AAH5caaAxLOpy4C9Z1Z5_dzkR6DhCWU0mOE';
    // Setup polling way
    var bot = new TelegramBot(token, { polling: true });

    // Matches /echo [whatever]
    bot.onText(/\/echo (.+)/, function(msg, match) {
        var fromId = msg.from.id;
        console.log(fromId)
        var resp = match[1];
        bot.sendMessage(fromId, resp);
    });

    // Any kind of message
    bot.on('message', function(msg) {
        var chatId = msg.chat.id;
        // photo can be: a file path, a stream or a Telegram file_id
        var photo = 'cats.png';
        bot.sendPhoto(chatId, photo, { caption: 'Lovely kittens' });
    });

    return bot
}
