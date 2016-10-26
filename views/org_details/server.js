const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');


console.log("starting school engine".blue)
console.log({
    cassandra_host: process.env.OPENSHIFT_CASSANDRA_DB_HOST,
    cassandra_port: process.env.OPENSHIFT_CASSANDRA_DB_PORT,
    cassandra_log_dir: process.env.OPENSHIFT_CASSANDRA_DB_LOG_DIR,
    cassandra_native_transport_port: process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT
})

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now


const contactPoint2 = process.env.OPENSHIFT_CASSANDRA_DB_HOST + ":" + process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT

var connectionOptions = {
    contactPoints: [(process.env.OPENSHIFT_CASSANDRA_DB_HOST ? contactPoint2 : "localhost")],
    keyspace: 'sms_master'
};

var client = new cassandra.Client(connectionOptions);

// Authentication and Authorization Middleware
var auth = function(req, res, next) {
    if (req.session.org_id)
        return next();
    else
        return res.redirect("/")
};

module.exports = function(app) {
    app.route("/org_details")
        .get(auth, (req, res) => {
            const query = `select * from sms_master.organisations where id=? allow filtering`;

            client.execute(query, [req.session.org_id], function(err, result) {
                assert.ifError(err);
                console.log(result.rows[0])
                const organisation = result.rows[0]
                console.log(organisation)
                var rows = []

                console.log(req.session.user)

                res.render('org_details/new', {
                    layout: "bulkSMS",
                    session: req.session,
                    status: "Online",
                    page: "Organisation Information",
                    form: {
                        title: "Add new Organisation Details",
                        action: "",
                        method: "post",
                        fields: [{
                            name: "Org Name",
                            placeholder: "  ",
                            type: "text",
                            value: organisation.name
                        }, {
                            name: "Location",
                            placeholder: " ",
                            type: "text",
                            value: organisation.location
                        }]
                    }
                });
            });

        })
        .post((req, res) => {
            console.log(req.body)
                // read the values and validate, post to the db or reply with errors

            client.batch([{
                query: `INSERT INTO sms_master.organisations (id, name, location) VALUES (?, ?, ?);`,
                params: [req.session.org_id, req.body["Org Name"], req.body["Location"]]
            }], function(err, result) {
                assert.ifError(err)
                console.log(result)
                    // change the session object to update the ui
                req.session.org_name = req.body["Org Name"]
                res.redirect("/org_details")
            })
        })

    app.get("/org_details/delete/:message_id", auth, (req, res) => {

        const query = `delete from sms_master.org_details where id=?`;

        client.execute(query, [req.params.message_id], function(err, result) {
            assert.ifError(err);
            console.log(result)
            res.redirect("/org_details")
        });

    })

    app.route("/org_details/new")
        .get(function(req, res) {
            res.render('org_details/new', {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Registration",
                back: "Front Office",
                new: "/branches/new",
                form: {
                    title: "Add new Organisation Details",
                    action: "",
                    method: "post",
                    fields: [{
                        name: "Org Name",
                        placeholder: "  ",
                        type: "text"
                    }, {
                        name: "Location",
                        placeholder: " ",
                        type: "text"
                    }, {
                        name: "Api_username",
                        placeholder: " ",
                        type: "text"
                    }, {
                        name: "Api_key",
                        placeholder: " ",
                        type: "text"
                    }]
                }
            });
        })
        .post(function(req, res) {
            console.log(req.body)
                // read the values and validate, post to the db or reply with errors

            client.batch([{
                query: `INSERT INTO sms_master.org_details (id, name, location, username, key) VALUES (?, ?, ?, ?, ?);`,
                params: [timeId.now(), req.body["Org Name"], req.body["Location"], req.body["Api_username"], req.body["Api_key"]]
            }], function(err, result) {
                assert.ifError(err)
                res.redirect("/org_details")
            })
        })

    app.route("/org_details/:message_id")
        .get(function(req, res) {

            const query = `select * from sms_master.org_details where id=?`,
                params = [req.params.message_id]

            client.execute(query, params, function(err, result) {
                assert.ifError(err)
                details = result.rows[0]
                res.render('org_details/new', {
                    layout: "bulkSMS",
                    session: req.session,
                    status: "Online",
                    page: "Registration",
                    back: "Front Office",
                    form: {
                        title: "Edit " + details.name,
                        action: "",
                        method: "post",
                        fields: [{
                            name: "Org Name",
                            placeholder: "  ",
                            type: "text",
                            value: details.name
                        }, {
                            name: "Location",
                            placeholder: " ",
                            type: "text",
                            value: details.location
                        }, {
                            name: "Api_username",
                            placeholder: " ",
                            type: "text",
                            value: details.username
                        }, {
                            name: "Api_key",
                            placeholder: " ",
                            type: "text",
                            value: details.key
                        }]
                    }
                });

            })

        })
        .post(function(req, res) {
            client.batch([{
                query: `INSERT INTO sms_master.org_details (id, name, location, username, key) VALUES (?, ?, ?, ?, ?);`,
                params: [req.params.message_id, req.body["Org Name"], req.body["Location"], req.body["Api_username"], req.body["Api_key"]]
            }], function(err, result) {
                assert.ifError(err)
                res.redirect("/org_details")
            })
        })

}
