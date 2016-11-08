const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
var PNF = require('google-libphonenumber').PhoneNumberFormat;
var request = require("request")
const cassie = require("./query_creator")
const accounting = require("accounting")

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now



module.exports = function(numbers, messageOptions, cb) {
    console.log("workign on " + numbers.length + " of numbers;")
    var req = messageOptions.req
    var res = messageOptions.res
    var app = messageOptions.app
    const client = messageOptions.app.locals.db
    var auth = app.locals.auth

    var resolvedNumbers = []
    var sendresults = []

    const instance = {
        id: timeId.now(),
        admin: req.session.user_id,
        organisation: req.session.org_id
    }

    // find the rate that has been set per organisation
    client.execute("select * from organisation_rates where organisation = ? and active=? ALLOW FILTERING;", [req.session.org_id, true], (err, results) => {
        assert.ifError(err)
        const percentage = results.rows[0].percentage
        console.log("PERCENTAGE IS - " + percentage)
        instance.rate_id = results.rows[0].rate_id

        // get the details of the user, save the quick message, save the contacts who were involved
        async.each(numbers, (number, nextNumberCb) => {
                client.execute("select * from contacts where phone_number = ? ALLOW FILTERING;", [number], (err, results) => {
                    assert.ifError(err)
                        // store the thing to be batched
                    var batch = []

                    var firstname = results.rows[0].user_name.split(" ")[0]

                    var completeData = {
                        id: results.rows[0].id,
                        name: firstname,
                        number: convert(number),
                        message: (messageOptions.subject ? messageOptions.subject : "") + "\n\n" + (messageOptions.prefix ? messageOptions.prefix : "") + " " + firstname + ",\n " + messageOptions.body + "\n\n"
                    }

                    // send the message
                    sendMessage([completeData.number, completeData.message], (err, results) => {
                        assert.ifError(err)
                            // console.log(results)
                        completeData.sending_results = results.response[0]
                        sendresults.push(completeData)

                        console.log("cost of this message is " + percentage * completeData.sending_results.cost)
                        const message = {
                            id: timeId.now(),
                            message: completeData.message,
                            instance: instance.id,
                            cost: Number(completeData.sending_results.cost)
                        }

                        // console.log(message)

                        batch.push(cassie.insertMaker({
                            keyspace: "sms_master",
                            table: "quick_sent_messages",
                            record: message
                        }))

                        batch.push(cassie.insertMaker({
                            keyspace: "sms_master",
                            table: "contacts_quick_messages",
                            record: {
                                id: timeId.now(),
                                contact: completeData.id,
                                quick_message: message.id
                            }
                        }))

                        client.batch(batch, { prepare: true }, (err, results) => {
                            assert.ifError(err)
                            nextNumberCb()
                        })
                    })

                })
            },
            function() {
                var batches = []
                var batch = []
                    // insert the results to the db in a batch
                console.log(instance)

                batch.push(cassie.insertMaker({
                    keyspace: "sms_master",
                    table: "message_instance",
                    record: instance
                }))

                client.batch(batch, { prepare: true }, (err, results) => {
                    assert.ifError(err)
                    res.redirect("/sendResults/" + instance.id)
                })
            })
    })

    function convert(number) {
        if (Number(number)) {
            var phoneNumber = phoneUtil.parse(number, 'KE');
            return phoneUtil.format(phoneNumber, PNF.INTERNATIONAL)
        }
    }
}


function sendMessage(dataArray, cb) {

    console.log(dataArray)

    // Define the recipient numbers in a comma separated string
    // Numbers should be in international format as shown
    var to = dataArray[0]

    // And of course we want our recipients to know what we really do
    var message = dataArray[1];

    var postData = {
        "message": message,
        "recipient": to,
        "username": "Branson",
        "apikey": "908b353c4496d48ab1167ee4d2ffae1477059578",
        "senderId": "DC-THETA"
    }

    // console.log(postData)

    request.post({
        url: 'http://mobilesasa.com/sendsmsjson.php',
        body: postData,
        json: true
    }, function(error, response, body) {
        // console.log(body)
        assert.ifError(error)
            // if (!error && response.statusCode == 200) {
            //     console.log(body)
            // }
        cb(null, body)
    })


}
