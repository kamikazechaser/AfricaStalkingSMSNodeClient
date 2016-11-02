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


const contactPoint2 = process.env.OPENSHIFT_CASSANDRA_DB_HOST + ":" + process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT

var connectionOptions = {
    contactPoints: [(process.env.OPENSHIFT_CASSANDRA_DB_HOST ? contactPoint2 : "localhost")],
    keyspace: 'sms_master'
};

var client = new cassandra.Client(connectionOptions);

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now



module.exports = function(numbers, messageOptions, cb) {
    var req = messageOptions.req
    var res = messageOptions.res
    var resolvedNumbers = []
    var sendresults = []

    // get the details of the user, save the quick message, save the contacts who were involved
    async.each(numbers, (number, nextNumberCb) => {
            client.execute("select * from contacts where phone_number = ? ALLOW FILTERING;", [number], (err, results) => {
                assert.ifError(err)
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
                    console.log(results)
                    completeData.sending_results = results.response[0]
                    sendresults.push(completeData)
                    nextNumberCb()
                })

            })
        },
        function() {
            var batch = []
                // insert the results to the db in a batch

            const instance = {
                id: timeId.now(),
                admin: req.session.user_id
            }

            batch.push(cassie.insertMaker({
                keyspace: "sms_master",
                table: "message_instance",
                record: instance
            }))

            // message_instance
            sendresults.map((result) => {
                    console.log("result", result)

                    const message = {
                        id: timeId.now(),
                        message: result.message,
                        instance: instance.id,
                        cost: Number(result.sending_results.cost)
                    }

                    console.log(message)

                    // create the message
                    batch.push(cassie.insertMaker({
                            keyspace: "sms_master",
                            table: "quick_sent_messages",
                            record: message
                        }))
                        // save that the message was sent to this user
                    batch.push(cassie.insertMaker({
                        keyspace: "sms_master",
                        table: "contacts_quick_messages",
                        record: {
                            id: timeId.now(),
                            contact: result.id,
                            quick_message: message.id
                        }
                    }))
                })
                // save the message in the db before sending,


            client.batch(batch, { prepare: true }, (err, results) => {
                // assert.ifError(err)

                // cb(err)
                res.redirect("/sendResults/" + instance.id)

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
