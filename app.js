'use strict';

const express = require('express');
const line = require('@line/bot-sdk');
const firebase = require('firebase');

const config = {
    channelAccessToken: 'SZZhdv+zS6hNBkhCHfvcLFr7gwXLoIy8pw+O8HMT0XC8t3CJioHrFcZSPMsqCGUV78V2G2nmlg2tMbq1ZJThfQxYgCw640EiXYv43CSdOxpHhVUrcTWS9AN++Xpt8AARAPIeG12Lk7mgWsCCx9MChgdB04t89/1O/w1cDnyilFU=',
    channelSecret: 'c260b7ad82f4c500992252dbab2e4a6a'
};

var firebaseConfig = {
    apiKey: "AIzaSyDR17mmYXtGykeKGyWeeEidno-2Sy-vVsU",
    authDomain: "icmarketing-5d826.firebaseapp.com",
    databaseURL: "https://icmarketing-5d826.firebaseio.com",
    projectId: "icmarketing-5d826",
    storageBucket: "icmarketing-5d826.appspot.com",
    messagingSenderId: "801556155930"
};
firebase.initializeApp(firebaseConfig);
var database = firebase.database();
const app = express();
app.set('port',(process.env.PORT || 3000))
app.post('/webhook', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.log(err);
            res.status(500).end();
        });
    res.status(200);
});

const client = new line.Client(config);

function handleEvent(event) {
    console.log(event)
    if(event.type === 'postback'){
        return handlePostbackEvent(event);
    }
    else if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }
    else{
        return handleMessageEvent(event);
    }
}

function handlePostbackEvent(event) {
    var menu = event.postback.data;
    console.log(menu)
    writeUserBill(event.source.userId,menu)
    var msg = {
        type : 'text',
        text : `Added ${menu}`
    }
    console.log('handle postback',msg);
    return client.replyMessage(event.replyToken,msg);
}

function handleMessageEvent(event){
    var eventText = event.message.text.toLowerCase();
    var msg = {
        type : 'text',
        text : eventText
    }
    if(eventText === 'menu'){
        msg = {
            "type": "template",
            "altText": "this is a carousel template",
            "template": {
                "type": "carousel",
                "actions": [],
                "columns": [
                    {
                        "thumbnailImageUrl": "https://au.cafe-royal.com/media/image/00/11/fb/159c24484e98cd.jpg",
                        "title": "Espresso",
                        "text": "35 ฿",
                        "actions": [
                            {
                                "type": "postback",
                                "label": "Add",
                                "data": "name=Espresso&price=35"
                            }
                        ]
                    },
                    {
                        "thumbnailImageUrl": "https://www.merriam-webster.com/assets/mw/images/article/art-wap-article-main/cappuccino-2029-e80b7c6d318c7862df2c4c8623a11f99@1x.jpg",
                        "title": "Cappuccino",
                        "text": "40 ฿",
                        "actions": [
                            {
                                "type": "postback",
                                "label": "Add",
                                "data": "name=Cappuccino&price=40"
                            }
                        ]
                    }
                ]
            }
        }
    }else if (eventText === 'location'){
        msg = {
            type : 'location',
            title : 'Shop location',
            address : 'International College, Chalongkrung Road, Ladkrabang, Bangkok 10520 Thailand',
            latitude : 13.729994,
            longitude : 100.775289
        }
    }
    else if(eventText === 'start'){
        writeUserBill(event.source.userId,"Menu A")
        msg = {
            type : 'text',
            text : 'Menu created'
        }
    }
    console.log('handle msg',msg);
    return client.replyMessage(event.replyToken,msg);
}

function writeUserBill(userId,menu){
    firebase.database().ref('users/'+userId).set({
        menu : menu
    });
}

app.listen(app.get('port'),function(){
    console.log("line webhook run at port",app.get('port'))
});