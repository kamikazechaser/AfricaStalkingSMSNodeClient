const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
var PNF = require('google-libphonenumber').PhoneNumberFormat;
var request = require("request")
const cassie = require("../FRONTEND/query_creator")
const accounting = require("accounting")
var querystring = require('querystring');
var request = require('request');
var moment = require('moment');

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now


module.exports = function(app) {
    const client = app.locals.db
    var auth = app.locals.auth

    app.route("/")
        .get((req, res) => {
            res.render("logins/index", {
                layout: false,
                userType: "welcome..."
            });
        })
        .post((req, res) => {
            console.log(req.body)

            const query = `select * from sms_master.super_admins where user_name=? ALLOW FILTERING`;
            var params = [req.body.username]

            client.execute(query, params, function(err, result) {
                console.log(err)
                console.log(result)

                if (result.rows[0]) {
                    // chack if passwords are same
                    if (result.rows[0].password == req.body.password) {
                        // assign session and move to dashboard

                        //set the req object
                        req.session.username = req.body.username;
                        req.session.p_pic = (result.rows[0].p_pic || "Profile_avatar_placeholder_large.png");

                        res.redirect("dashboard")
                    } else {
                        // return with error
                        console.log("password issue")
                        res.render("logins/index", {
                            layout: false,
                            userType: "welcome...",
                            error: "The username and password are invalid",
                            username: req.body.username
                        });
                    }
                } else {
                    // return with error 
                    console.log("username issue")
                    res.render("logins/index", {
                        layout: false,
                        userType: "welcome...",
                        error: "The username and password are invalid",
                        username: req.body.username
                    });
                }
            })

        })

    app.get("/dashboard", auth, (req, res) => {
        const organisation = req.session
        console.log("organisation", organisation)
        var stats = {}
        async.parallel([
            function(next) {
                client.execute("select count(*) from organisations;", (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.org_count = results.rows[0].count
                    next()
                })
            },
            function(next) {
                client.execute("select count(*) from contacts;", (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.contacts_count = results.rows[0].count
                    next()
                })
            },
            function(next) {
                client.execute("select count(*) from groups;", (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.groups_count = results.rows[0].count
                    next()
                })
            },
            function(next) {
                client.execute("select count(*) from quick_sent_messages;", (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.messages_count = results.rows[0].count
                    next()
                })
            },
            function(next) {
                client.execute("select * from contacts;", (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.contacts = []
                    results.rows.map((row) => stats.contacts.push({
                        value: row.phone_number,
                        text: row.user_name + "(" + row.phone_number + ")"
                    }))
                    next()
                        // console.log(stats.contacts)
                })
            }
        ], (err) => {
            // get a row count of some tables
            res.render('website/dashboard', {
                layout: "bulkSMS",
                session: req.session,
                stats: stats,
                status: "Online",
                page: "Dashboard",
                back: "Version 2.0",
                form: {
                    title: "Send a quick message",
                    action: "/quickmessage",
                    method: "post",
                    fields: [{
                        name: "Subject",
                        type: "text"
                    }, {
                        name: "Prefix",
                        type: "text",
                        placeholder: " "
                    }, {
                        name: "Select Contacts",
                        select: true,
                        multiple: "multiple",
                        add_class: "col-xs-3",
                        selects: stats.contacts
                    }, {
                        name: "Enter message",
                        textarea: true
                    }]
                }
            })
        })

    })

    app.get("/organisations", auth, (req, res) => {
        console.log(req.session)

        const query = `select * from sms_master.organisations`;

        client.execute(query, function(err, result) {
            assert.ifError(err);
            console.log(result.rows)

            var rows = []

            result.rows.map((row) => {
                row.details = moment(row.id.getDate()).calendar()
                row.view_link = ("/admins/" + row.user_name)
                row.edit_link = ("/contacts/edit/" + row.username)
                row.delete_link = ("/admins/delete/" + row.user_name)
            })

            var renderData = {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Organisations",
                organisations: result.rows
            }

            res.render('organisations/list', renderData);

        });

    })
}
