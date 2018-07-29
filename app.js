'use strict';

const express = require('express');
const line = require('@line/bot-sdk');
const linePay = require('line-pay')
const url = require('url');
const admin = require('firebase-admin');


const pay = new linePay({
    channelId: 'CHANNEL',
    channelSecret: 'LINE_PAY_TOKEN',
    isSandbox: true
})

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://icmarketing-5d826.firebaseio.com"
});

const db = admin.firestore();


const app = express();
app.set('port', 8080)
app.post('/webhook', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map((event) => handleEvent(req, event)))
        .then((result) => res.json(result))
        .catch((err) => {
            console.log(err);
            res.status(500).end();
        });
    res.status(200);
});

const client = new line.Client(config);

function handleEvent(req, event) {
    console.log(event.type)
    if (event.type === 'postback') {
        return handlePostbackEvent(req, event);
    }
    else if (event.type === 'message' && event.message.type === 'location') {
        return handleLocationEvent(event);
    }
    else if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }
    else {
        return handleMessageEvent(event);
    }
}

function handleLocationEvent(event) {
    console.log("loc", event)
    writeUserLocation(event.source.userId, event.message);
    return client.replyMessage(event.replyToken, {type: 'text', text: 'Location confirmed!'}).then(res => {
        summaryUserOrder(event.source.userId);
    })
}

function handlePostbackEvent(req, event) {
    var urldata = '?' + event.postback.data;
    console.log(urldata)
    var data = url.parse(urldata, true).query
    console.log(data)
    if (data.action === 'order') {
        writeUserBill(event.source.userId, data.name, data.price)
        var msg = {
            type: 'text',
            text: `Added ${data.name} ${data.price} ฿`
        }
        console.log('handle postback', msg);
        return client.replyMessage(event.replyToken, msg);
    } else if (data.action === 'pay') {
        if (data.confirm === 'yes') {
            console.log(data.price)
            var amount = parseInt(data.price)
            if (amount === 0) amount = 1;
            let reservation = {
                productName: "Order",
                amount: amount,
                currency: "THB",
                confirmUrl: `https://${req.hostname}/pay/confirm`,
                confirmUrlType: "SERVER",
                orderId: `${event.source.userId}-${Date.now()}`
            }
            pay.reserve(reservation).then((response) => {
                reservation.transactionId = response.info.transactionId;
                reservation.userId = event.source.userId;
                writeUserTransaction(event.source.userId, response.info.transactionId, amount, 'THB',false);
                let message = {
                    type: "template",
                    altText: "Please proceed to the payment.",
                    template: {
                        type: "buttons",
                        text: "Please proceed to the payment.",
                        actions: [
                            {type: "uri", label: `Pay by LINE Pay`, uri: response.info.paymentUrl.web},
                        ]
                    }
                }
                return client.replyMessage(event.replyToken, message);
            })
        } else {
            console.log('cancel payment')
        }
    }

}

async function handleMessageEvent(event) {
    var eventText = event.message.text.toLowerCase();
    var msg = {
        type: 'text',
        text: eventText
    }
    if (eventText === 'menu') {
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
                                "data": "action=order&name=Espresso&price=35"
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
                                "data": "action=order&name=Cappuchino&price=40"
                            }
                        ]
                    },
                    {
                        "thumbnailImageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_coffee.JPG/1200px-A_small_cup_of_coffee.JPG",
                        "title": "Americano",
                        "text": "35 ฿",
                        "actions": [
                            {
                                "type": "postback",
                                "label": "Add",
                                "data": "action=order&name=Americano&price=35"
                            }
                        ]
                    },
                    {
                        "thumbnailImageUrl": "https://images-gmi-pmc.edge-generalmills.com/a5e741a2-4a7b-4138-89f4-6c781a28c2ff.jpg",
                        "title": "Cookies (2 pcs)",
                        "text": "60 ฿",
                        "actions": [
                            {
                                "type": "postback",
                                "label": "Add",
                                "data": "action=order&name=Cookies&price=60"
                            }
                        ]
                    },
                    {
                        "thumbnailImageUrl": "https://www.dollartree.com/assets/product_images_2016/styles/xlarge/192833.jpg",
                        "title": "Water",
                        "text": "10 ฿",
                        "actions": [
                            {
                                "type": "postback",
                                "label": "Add",
                                "data": "action=order&name=Water&price=10"
                            }
                        ]
                    }
                ]
            }
        }
        return client.replyMessage(event.replyToken, msg);
    } else if (eventText === 'location') {
        msg = {
            type: 'location',
            title: 'Shop location',
            address: 'International College, Chalongkrung Road, Ladkrabang, Bangkok 10520 Thailand',
            latitude: 13.729994,
            longitude: 100.775289
        }
        return client.replyMessage(event.replyToken, msg);
    }
    else if (eventText === 'bill') {
        var items = []
        getUserBill(event.source.userId)
            .then(doc => {
                doc.forEach(item => {
                    items.push(item.data())
                })
                console.log(items)
                var itemListString = ''
                var sum = 0
                items.forEach(item => {
                    itemListString += `\n${item.menu} : ${item.price} ฿`
                    sum += parseInt(item.price);
                })
                console.log(itemListString)
                msg = {
                    type: 'text',
                    text: `Current Bill  \n${itemListString} \n\n Total : ${sum} ฿`
                }
                return client.replyMessage(event.replyToken, msg).then(res => {
                    client.pushMessage(event.source.userId, {
                        type: "template",
                        altText: "this is a buttons template",
                        template: {
                            type: "buttons",
                            actions: [
                                {
                                    type: "uri",
                                    label: "Location",
                                    uri: "line://nv/location"
                                }
                            ],
                            title: "Your location",
                            text: "Please confirm your location"
                        }
                    })
                })
            })
            .catch(err => {
                console.log(err)
            })
    }
    else if (eventText === 'clear') {
        clearBill(event.source.userId);
        return client.replyMessage(event.replyToken, {type: 'text', text: 'Bill cleared!'});

    }
    else {
        return client.replyMessage(event.replyToken, msg);
    }

}

function writeUserBill(userId, menu, price) {
    const collectionRef = db.collection('users').doc(userId).collection('itemList');
    collectionRef.get()
        .then(doc => {
            collectionRef.add({
                menu: menu,
                price: price
            });
        })
        .catch(err => {
            console.log("error", err)
        })
    writeUserProfile(userId);
}

function writeUserTransaction(userId, transactionId, amount, currency,status) {
    const collectionRef = db.collection('users').doc(userId);
    collectionRef.set({
        transaction: {
            transactionId: transactionId,
            amount: amount,
            currency: currency,
            status : status
        }
    }, {merge: true})
}

function writeUserProfile(userId){
    const collectionRef = db.collection('users').doc(userId);
    client.getProfile(userId)
        .then((response) => {
            console.log(response)
            collectionRef.set({
                userProfile : {
                    displayName : response.displayName,
                    pictureUrl : response.pictureUrl
                }
            },{merge : true})
        })
}
function writeUserLocation(userId, message) {
    const collectionRef = db.collection('users').doc(userId);
    console.log(message.latitude, message.longitude)
    collectionRef.set({
        location: {
            address: message.address,
            latitude: message.latitude,
            longitude: message.longitude
        },
    }, {merge: true})
        .then(res => {
            console.log(res)
            console.log('save location')
        })
        .catch(err => {
            console.log("error", err)
        })
}


function getUserBill(userId) {
    const collectionRef = db.collection('users').doc(userId).collection('itemList');
    return collectionRef.get()
}

function clearBill(userId) {
    const collectionRef = db.collection('users').doc(userId).collection('itemList');
    collectionRef.get()
        .then(doc => {
            doc.forEach(item => {
                console.log(item.ref.id)
                collectionRef.doc(item.ref.id).delete()
            })
        })
}

function summaryUserOrder(userId) {
    var summaryString = 'Your order\n'
    var items = []
    var sum = 0
    getUserBill(userId)
        .then(doc => {
            doc.forEach(item => {
                items.push(item.data())
            })
            console.log(items)
            items.forEach(item => {
                summaryString += `\n${item.menu} : ${item.price} ฿`
                sum += parseInt(item.price);
            })
            summaryString += `\n\nTotal : ${sum} ฿`

        })
        .then(res => {
            const collectionRef = db.collection('users').doc(userId);
            collectionRef.get()
                .then(doc => {
                    if (!doc.exists) {
                        console.log("doc not exist")
                    } else {
                        console.log(doc.data())
                        summaryString += `\n\nDelivery address \n\n${doc.data().location.address}`
                    }
                })
                .then(res => {
                    client.pushMessage(userId, {type: 'text', text: summaryString}).then(res => {
                        client.pushMessage(userId, {
                            type: "template",
                            altText: "this is a confirm template",
                            template: {
                                type: "confirm",
                                actions: [
                                    {
                                        type: "postback",
                                        label: "Yes",
                                        data: `action=pay&confirm=yes&price=${sum}`
                                    },
                                    {
                                        type: "postback",
                                        label: "No",
                                        data: "action=pay&confirm=no"
                                    }
                                ],
                                text: `Pay ${sum}฿ with LINE Pay`
                            }
                        })
                    })
                })
        })

}


app.get("/pay/confirm", (req, res, next) => {
    const transactionId = req.query.transactionId;
    const userId = req.query.orderId.split('-')[0];
    const collectionRef = db.collection('users').doc(userId).get().then(result => {
        const transaction = result.data().transaction;
        let confirmation = {
            transactionId: transactionId,
            amount: transaction.amount,
            currency: transaction.currency
        }
        writeUserTransaction(userId,transactionId,transaction.amount,transaction.currency,true);
        return pay.confirm(confirmation).then((response) => {
            res.sendStatus(200);
            let messages = [{
                type: "sticker",
                packageId: 2,
                stickerId: 144
            }, {
                type: "text",
                text: "Thank you for purchasing 💸"
            }]
            return client.pushMessage(userId,messages);
        })
    })
});

app.listen(app.get('port'), function () {
    console.log("line webhook run at port", app.get('port'))
});
