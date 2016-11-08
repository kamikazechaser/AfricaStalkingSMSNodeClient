const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
var PNF = require('google-libphonenumber').PhoneNumberFormat;
var request = require("request")
const cassie = require("../../query_creator")
const accounting = require("accounting")
var querystring = require('querystring');
var request = require('request');
var moment = require('moment');



var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now


module.exports = function(app) {
    const client = app.locals.db
    var auth = app.locals.auth

    app.get("/accounts", auth, (req, res) => {
        // console.log(req.session)
        var renderData = {
            layout: "bulkSMS",
            session: req.session,
            status: "Online",
            page: "Organisation"
        }

        async.parallel([
            function rates(next) {
                client.execute("select * from organisation_rates where organisation =?;", [req.session.org_id], (err, result) => {
                    assert.ifError(err)
                    renderData.rates = result.rows
                    result.rows.map((row) => {
                        row.date = moment(row.rate_id.getDate()).calendar()
                        row.activate = "/organisations/" + req.session.org_id + "/rates/" + row.rate_id + "/activate"
                        if (row.active === true) {
                            renderData.rate = row.percentage
                            renderData.newrate = "/organisations/" + req.session.org_id + "/rates/new"
                            renderData.newpayment = "/organisations/" + req.session.org_id + "/payments/new"
                            renderData.newcharge = "/organisations/" + req.session.org_id + "/charges/new"
                        }
                    })
                    next()
                })
            },
            function payments(next) {
                client.execute("select * from organisation_payments where organisation =?;", [req.session.org_id], (err, result) => {
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

                client.execute(query, [req.session.org_id], function(err, result) {
                    assert.ifError(err)
                    result.rows.map((row) => { row.time = moment(row.id.getDate()).calendar() })

                    async.each(result.rows, (instance, nextRow) => {
                        // get how many people were reached

                        // find the rate of every instance
                        client.execute(`select * from organisation_rates where organisation=? and rate_id=? allow filtering`, [req.session.org_id, (instance.rate_id ? instance.rate_id : timeId.now())], (err, rateResults) => {
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
            res.render('accounts/dashboard', renderData);
        })
    })
}
