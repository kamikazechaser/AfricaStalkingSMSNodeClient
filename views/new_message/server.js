const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');
var request = require("request")

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now

module.exports = function(app) {
    const client = app.locals.db
    var auth = app.locals.auth
    app.route("/new_message")
        .get(auth, (req, res) => {

            const query = `select * from sms_master.messages`;

            client.execute(query, function(err, result) {
                assert.ifError(err);
                console.log(result.rows)

                result.rows.map((row) => {
                    row.use_link = "/new_message/" + row.id
                })

                var renderData = {
                    layout: "bulkSMS",
                    session: req.session,
                    savedMessages: result.rows,
                    status: "Online",
                    page: "Messages",
                    back: "Dashboard",
                    new: "/messages/new",
                    form: {
                        title: "New message",
                        action: "",
                        method: "post",
                        fields: [{
                            name: "Prefix",
                            placeholder: " ",
                            type: "text"
                        }, {
                            name: "Title",
                            placeholder: " ",
                            type: "text"
                        }, {
                            name: "Content",
                            placeholder: " ",
                            type: "textarea",
                            textarea: true
                        }]
                    }
                }

                res.render('new_message/new', renderData);
            });
        })
        .post(auth, (req, res) => {
            req.session.message = {
                prefix: req.body["Prefix"],
                title: req.body["Title"],
                message: req.body["Content"]
            }

            res.redirect("/new_message/selectGroup")
        })

    app.get("/new_message/selectGroup", function(req, res) {
        client.execute("select * from sms_master.groups", function(err, result) {
            if (!err) {
                // console.log(result)
                // get number of contacts in group first
                async.each(result.rows, (row, nextRow) => {
                    client.execute("select * from sms_master.groups_per_contact where group=? allow FILTERING;", [row.id], function(err, result) {
                        assert.ifError(err)
                        row.send_link = "/send_message/" + row.id
                        row.memberNumber = result.rows.length
                        row.specify_members_link = "/controlled_send_message/" + row.id
                        nextRow()
                    })
                }, function(argument) {
                    res.render('new_message/selectGroup', {
                        session: req.session,
                        groups: result.rows,
                        layout: "bulkSMS"
                    });
                })
            }
        })
    })

    app.route("/controlled_send_message/:group_id")

    .get(function(req, res) {
        client.execute("select * from sms_master.groups_per_contact where group=? ALLOW FILTERING", [req.params.group_id], function(err, result) {
            assert.ifError(err)
            var finalcontacts = []

            async.filter(result.rows, function(contact, cb) {
                console.log(contact)
                client.execute("select * from sms_master.contacts where id=?", [contact.contact], function(err, contacts) {
                    assert.ifError(err)
                    contacts.rows.map((contact1) => {
                        finalcontacts.push({
                            id: contact1.id,
                            name: contact1.user_name,
                            phone_number: contact1.phone_number
                        })
                    })

                    cb()
                })

            }, function(err) {
                console.log(finalcontacts)
                res.render('new_message/selectUsersInGroup', {
                    session: req.session,
                    name: "Specify who to send the message to",
                    contacts: finalcontacts,
                    layout: "bulkSMS"
                });
            })


        })
    })

    .post(function(req, res) {

        var numbers = []
        var convertedNumbers = []
        Object.keys(req.body).map(function(number) {
                if (Number(number)) {
                    numbers.push(number)
                } else {
                    console.log(number + " provided is an invalid number")
                }
            })
            // send the numbers to send the sms.

        var messageOptions = {
            req: req,
            res: res,
            subject: req.session.message.title,
            prefix: req.session.message.prefix,
            body: req.session.message.message
        }
        console.log("sending " + numbers.length + " from the controlled sender out of " + Object.keys(req.body).length)
        require("../../sender")(numbers, messageOptions)
    })

    app.get("/new_message/:saved_message_id", function(req, res) {
        const query = `select * from sms_master.messages where id=?`;

        client.execute(query, [req.params.saved_message_id], function(err, result) {
            assert.ifError(err)
            var message = result.rows[0]

            req.session.message = {
                title: message.title,
                message: message.content
            }

            res.redirect("/new_message/selectGroup")
        })
    })

    // Require `PhoneNumberFormat`. 
    var PNF = require('google-libphonenumber').PhoneNumberFormat;

    // Get an instance of `PhoneNumberUtil`. 
    var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();


    app.get("/send_message/:group_id", function(req, res) {
        client.execute("select * from sms_master.groups_per_contact where group=? ALLOW FILTERING", [req.params.group_id], function(err, result) {
            assert.ifError(err)
            if (!err) {
                // console.log(result)

                var phone_numbers = []
                var invalidNumbers = []

                async.each(result.rows, function(item, next) {
                    client.execute("select * from sms_master.contacts where id=?", [item.contact], function(err, result) {
                        assert.ifError(err)
                            // console.log(result.rows)
                        result.rows[0] ? phone_numbers.push(result.rows[0].phone_number) : invalidNumbers.push(item.id)
                        next()
                    })

                }, function(err) {

                    console.log(invalidNumbers.length + " are invalid numbers in groups_per_contact")
                    console.log("need to clean up :-)")
                    invalidNumbers.map((number) => {
                        console.log("attemmpting to delete " + number)
                        client.execute("delete from sms_master.groups_per_contact where id=?", [number], function(err, result) {
                            assert.ifError(err)
                            console.log("deleted " + number + " from groups_per_contact")
                        })
                    })

                    var messageOptions = {
                        req: req,
                        res: res,
                        subject: req.session.message.title,
                        prefix: req.session.message.prefix,
                        body: req.session.message.message
                    }
                    console.log(phone_numbers)
                    require("../../sender")(phone_numbers, messageOptions)
                })

            }
        })

    })
}
