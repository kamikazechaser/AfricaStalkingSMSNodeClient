const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');
const cassie = require("./query_creator")

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now

module.exports = function(app) {
    const client = app.locals.db
    var auth = app.locals.auth
        // be the last thing
    app.route("/")
        .get((req, res) => {
            res.render("website/home", {
                layout: false
            });
        })
        .post((req, res) => {
            console.log(req.body)

            // for registering users
            req.body.id = timeId.now()

            const admin = {
                user_name: req.body.email,
                password: req.body.password
            }

            const organisation = {
                id: timeId.now(),
                name: req.body.organisation
            }

            // remove the organisation text so it wount be entered into the contacts
            delete req.body.organisation

            const admins_for_organisation = {
                user_name: admin.user_name,
                organisation: organisation.id
            }

            var structure = [
                cassie.insertMaker({
                    keyspace: "sms_master",
                    table: "registering_users",
                    record: req.body
                }),

                cassie.insertMaker({
                    keyspace: "sms_master",
                    table: "organisations",
                    record: organisation
                }),

                cassie.insertMaker({
                    keyspace: "sms_master",
                    table: "admins",
                    record: admin
                }),

                cassie.insertMaker({
                    keyspace: "sms_master",
                    table: "admins_for_organisation",
                    record: admins_for_organisation
                })
            ]

            client.batch(structure, function(err, results) {
                assert.ifError(err)
                console.log("batch was successfull")
                    // sent email verification page
                client.execute("select * from admins_for_organisation where user_name=?", [req.body.email], (err, admins_for_organisations) => {
                    assert.ifError(err)
                        // check the number of orgs, start with only one and send there direct
                    console.log(admins_for_organisations.rows)
                    var sessionData = admins_for_organisations.rows[0]
                    req.session.user_id = sessionData.user_name
                    req.session.org_id = sessionData.organisation
                    req.session.p_pic = "Profile_avatar_placeholder_large.png"
                    client.execute("select * from organisations where id=?", [sessionData.organisation], (err, organisation) => {
                        assert.ifError(err)
                        console.log("organisation details", organisation.rows)
                        req.session.org_name = organisation.rows[0].name;
                        res.redirect("/dashboard")
                    })
                })
            })
        })

    app.route("/verifyMAIL/:email")
        .get((req, res) => {
            client.execute("select * from registering_users where email=? ALLOW FILTERING", [req.params.email], (err, results) => {
                assert.ifError(err)
                res.render("website/verifypassword", {
                    layout: false,
                    header: "Hey " + results.rows[0].name + ","
                });
            })

        })
        .post((req, res) => {
            console.log(req.body)
            client.execute("select * from registering_users where email=? ALLOW FILTERING", [req.params.email], (err, results) => {
                assert.ifError(err)
                console.log(results.rows)
                    // console.log(results.rows)
                    // check if thats the correct password
                console.log(results.rows[0].password, req.body.password)
                if (results.rows[0].password == req.body.password) {
                    // get the organisation the user is registered to,
                    // if its only one, take direct and set that to the session
                    // if many, show a list of the organisations 
                    // if none, say that he is not set into any org and send to the creating thing
                    client.execute("select * from admins_for_organisation where user_name=?", [results.rows[0].email], (err, admins_for_organisations) => {
                        assert.ifError(err)
                            // check the number of orgs, start with only one and send there direct
                        console.log(admins_for_organisations.rows)
                        var sessionData = admins_for_organisations.rows[0]
                        req.session.user_id = sessionData.user_name
                        req.session.org_id = sessionData.organisation
                        res.redirect("/dashboard")
                    })

                } else {
                    res.render("website/verifypassword", {
                        layout: false,
                        header: "Hey " + results.rows[0].name + ",",
                        error: "Wrong verification password!"
                    });
                }

            })
        })
}
