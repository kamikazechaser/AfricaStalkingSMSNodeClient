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
                row.view_link = ("/organisations/" + row.id)
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

    app.get("/organisations/:org_id", auth, (req, res) => {
        // console.log(req.session)
        var renderData = {
            layout: "bulkSMS",
            session: req.session,
            status: "Online",
            page: "Organisation"
        }

        async.parallel([
            function rates(next) {
                renderData.newrate = "/organisations/" + req.params.org_id + "/rates/new"
                renderData.newpayment = "/organisations/" + req.params.org_id + "/payments/new"
                renderData.newcharge = "/organisations/" + req.params.org_id + "/charges/new"

                client.execute("select * from organisation_rates where organisation =?;", [req.params.org_id], (err, result) => {
                    assert.ifError(err)
                    renderData.rates = result.rows
                    result.rows.map((row) => {
                        row.date = moment(row.rate_id.getDate()).calendar()
                        row.activate = "/organisations/" + req.params.org_id + "/rates/" + row.rate_id + "/activate"
                        if (row.active === true) {
                            renderData.rate = row.percentage

                        }

                    })
                    next()
                })
            },
            function payments(next) {
                client.execute("select * from organisation_payments where organisation =?;", [req.params.org_id], (err, result) => {
                    assert.ifError(err)
                    renderData.payments = result.rows
                        // sum all the payments for display
                    renderData.payments_sum_float = 0
                    renderData.payments.map((row) => {
                        row.date = moment(row.payment_id.getDate()).calendar()
                        renderData.payments_sum_float = Number(renderData.payments_sum_float) + Number(row.ammount)
                        renderData.payments_sum = accounting.formatMoney(accounting.toFixed(Number(Number(renderData.payments_sum_float)), 2), "Ksh ");
                        row.ammount = accounting.formatMoney(accounting.toFixed(Number(row.ammount), 2), "Ksh ");
                    })
                    next()
                })
            },
            function charges(next) {
                const query = `select * from message_instance where organisation=? allow filtering`;
                var instance = {}

                client.execute(query, [req.params.org_id], function(err, result) {
                    assert.ifError(err)
                    result.rows.map((row) => { row.time = moment(row.id.getDate()).calendar() })

                    async.each(result.rows, (instance, nextRow) => {
                        // get how many people were reached

                        // find the rate of every instance
                        client.execute(`select * from organisation_rates where organisation=? and rate_id=? allow filtering`, [req.params.org_id, (instance.rate_id ? instance.rate_id : timeId.now())], (err, rateResults) => {
                            assert.ifError(err)
                            const percentage = rateResults.rows[0] ? rateResults.rows[0].percentage : 1
                            console.log(rateResults.rows)
                            instance.cost = 0
                            instance.bill = 0
                            async.parallel([
                                function(next) {
                                    const query = `select * from quick_sent_messages where instance=? allow FILTERING`;

                                    client.execute(query, [instance.id], { prepare: true }, function(err, result) {
                                        assert.ifError(err)

                                        var sum = 0
                                        result.rows.map((row) => {
                                            instance.cost = Number(instance.cost) + Number(row.cost)
                                        })
                                        result.rows.map((row) => {
                                            instance.bill = Number(instance.cost) + (Number(row.cost) * percentage)
                                        })
                                        instance.cost_raw = instance.cost;
                                        instance.bill_raw = instance.bill;
                                        instance.profit = instance.bill - instance.cost
                                        instance.profit_raw = instance.profit

                                        instance.cost = accounting.formatMoney(accounting.toFixed(Number(instance.cost), 2), "Ksh ");
                                        instance.bill = accounting.formatMoney(accounting.toFixed(Number(instance.bill), 2), "Ksh ");
                                        instance.profit = accounting.formatMoney(accounting.toFixed(Number(instance.profit_raw), 2), "Ksh ");

                                        instance.contactsReached = result.rows.length
                                        instance.view_link = "/sendResults/" + instance.id
                                        next()
                                    })
                                }

                            ], nextRow)
                        })

                    }, function done(argument) {
                        renderData.total_contacts_reached = 0
                        renderData.charges_sum_float = 0
                        renderData.charges_profit_float = 0
                        renderData.charges_bill_float = 0
                        renderData.charges = result.rows
                            // sum app the charges and get for display on UI
                        renderData.charges.map((row) => {
                            renderData.total_contacts_reached = Number(renderData.total_contacts_reached) + Number(row.contactsReached)
                            renderData.charges_profit_float = Number(renderData.charges_profit_float) + Number(row.profit_raw)
                            renderData.charges_sum_float = Number(renderData.charges_sum_float) + Number(row.cost_raw)
                            renderData.charges_bill_float = Number(renderData.charges_bill_float) + Number(row.bill_raw)

                            renderData.charges_sum = accounting.formatMoney(accounting.toFixed(Number(renderData.charges_sum_float), 2), "Ksh ");
                            renderData.bills_sum = accounting.formatMoney(accounting.toFixed(Number(renderData.charges_bill_float), 2), "Ksh ");
                            renderData.profits_sum = accounting.formatMoney(accounting.toFixed(Number(renderData.charges_profit_float), 2), "Ksh ");

                            row.ammount = accounting.formatMoney(accounting.toFixed(Number(row.ammount), 2), "Ksh ");
                        })
                        next()
                    })
                })
            }
        ], function(err) {
            res.render('organisations/single', renderData);
        })
    })

    app.route("/organisations/:org_id/rates/new")
        .get((req, res) => {
            res.render('organisations/rates/new', {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Dashboard",
                back: "Version 2.0",
                form: {
                    title: "Add a new rate",
                    action: "",
                    method: "post",
                    fields: [{
                        name: "rate",
                        type: "text",
                        add_class: `step="any"`,
                        placeholder: " "
                    }]
                }
            })
        })
        .post((req, res) => {
            console.log(req.body.rate)
            const rate = {
                organisation: req.params.org_id,
                rate_id: timeId.now(),
                percentage: req.body.rate,
                active: false
            }

            var structure = [
                // administration
                cassie.insertMaker({
                    keyspace: "sms_master",
                    table: "organisation_rates",
                    record: rate
                })

            ]

            client.batch(structure, function(err, results) {
                assert.ifError(err)
                console.log("batch was successfull")
                res.redirect("/organisations/" + req.params.org_id)
            })
        })

    app.route("/organisations/:org_id/rates/:rate_id/activate")
        .get(auth, (req, res) => {
            // find get all the rates, find anything thats not true and turn it into false
            // find the activated one and turn it into true
            // batch update

            client.execute("select * from organisation_rates where organisation =?;", [req.params.org_id], (err, result) => {
                assert.ifError(err)
                async.each(result.rows, (row, nextRow) => {
                    if (row.status != "active") {
                        // run update here dont batch
                        client.execute("UPDATE organisation_rates SET active=? WHERE rate_id = ? and organisation = ?;", [false, row.rate_id, req.params.org_id], (err, result) => {
                            assert.ifError(err)
                            nextRow()
                        })
                    }
                }, function() {
                    // activate the one to be activated
                    client.execute("UPDATE organisation_rates SET active=? WHERE rate_id = ? and organisation = ?;", [true, req.params.rate_id, req.params.org_id], (err, result) => {
                        assert.ifError(err)
                        res.redirect("/organisations/" + req.params.org_id)
                    })
                })
            })

        })


    app.route("/organisations/:org_id/payments/new")
        .get((req, res) => {
            res.render('organisations/payments/new', {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Payments",
                back: "Organisations",
                form: {
                    title: "Add a new Payment",
                    action: "",
                    method: "post",
                    fields: [{
                        name: "Ammount",
                        type: "number",
                        placeholder: "How much to be added to his account?"
                    }, {
                        name: "Channel",
                        select: true,
                        selects: [{
                            value: "MPESA",
                            text: "MPESA"
                        }, {
                            value: "Airtel money",
                            text: "Airtel money"
                        }, {
                            value: "Cash",
                            text: "Cash"
                        }, {
                            value: "Visa",
                            text: "Visa"
                        }],
                        placeholder: "through what methods was this payment made?"
                    }, {
                        name: "Reference ID",
                        type: "text",
                        placeholder: "Unique Number from payment platform"
                    }, {
                        name: "Payer Information",
                        type: "text",
                        placeholder: "Who made this payment and where?"
                    }]
                }
            })
        })
        .post((req, res) => {
            console.log(req.body.rate)
            const rate = {
                organisation: req.params.org_id,
                payment_id: timeId.now(),
                ammount: Number(req.body.Ammount),
                channel: req.body.Channel,
                ref_id: req.body["Reference ID"],
                contact: req.body["Payer Information"]
            }

            console.log(rate)

            var structure = [
                // administration
                cassie.insertMaker({
                    keyspace: "sms_master",
                    table: "organisation_payments",
                    record: rate
                })

            ]

            client.batch(structure, { prepare: true }, function(err, results) {
                assert.ifError(err)
                console.log("batch was successfull")
                res.redirect("/organisations/" + req.params.org_id)
            })
        })



}
