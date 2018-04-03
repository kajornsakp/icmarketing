const express = require('express');
const line = require('@line/bot-sdk');

const config = {
    channelAccessToken: 'SZZhdv+zS6hNBkhCHfvcLFr7gwXLoIy8pw+O8HMT0XC8t3CJioHrFcZSPMsqCGUV78V2G2nmlg2tMbq1ZJThfQxYgCw640EiXYv43CSdOxpHhVUrcTWS9AN++Xpt8AARAPIeG12Lk7mgWsCCx9MChgdB04t89/1O/w1cDnyilFU=',
    channelSecret: 'c260b7ad82f4c500992252dbab2e4a6a'
};

const app = express();
app.post('/webhook', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result));
});

const client = new line.Client(config);
function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    return client.replyMessage(event.replyToken, {
        type: 'text',
        text: event.message.text
    });
}

app.listen(3000);