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
    keyspace: 'schoolmaster'
};

var client = new cassandra.Client(connectionOptions);

// Authentication and Authorization Middleware
var auth = function(req, res, next) {
    if (req.session)
        return next();
    else
        return res.redirect("/")
};

module.exports = function(app) {
    app.get("/messages", auth, (req, res) => {

        const query = `select * from sms_master.messages`;

        client.execute(query, function(err, result) {
            assert.ifError(err);
            console.log(result.rows[0])
            var rows = []

            result.rows.map((row) => {
                row.view_link = ("/messages/" + row.id)
                row.edit_link = ("/messages/edit/" + row.id),
                    row.delete_link = ("/messages/delete/" + row.id)
            })

            console.log(req.session.user)

            var renderData = {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Messages",
                back: "Dashboard",
                messages: result.rows,
                new: "/messages/new",
                messages: result.rows
            }

            res.render('messages/list', renderData);
        });

    })

    app.get("/messages/delete/:message_id", auth, (req, res) => {

        const query = `delete from sms_master.messages where id=?`;

        client.execute(query, [req.params.message_id], function(err, result) {
            assert.ifError(err);
            console.log(result)
            res.redirect("/messages")
        });

    })

    app.route("/messages/new")
        .get(function(req, res) {
            res.render('messages/new', {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Registration",
                back: "Front Office",
                new: "/branches/new",
                form: {
                    title: "Add new admin",
                    action: "",
                    method: "post",
                    fields: [{
                        name: "Title",
                        placeholder: "  ",
                        type: "text"
                    }, {
                        name: "Content",
                        placeholder: " ",
                        type: "textarea"
                    }]
                }
            });
        })
        .post(function(req, res) {
            console.log(req.body)
                // read the values and validate, post to the db or reply with errors

            client.batch([{
                query: `INSERT INTO sms_master.messages (id, title, content) VALUES (?, ?, ?);`,
                params: [timeId.now(), req.body["Title"], req.body["Content"]]
            }], function(err, result) {
                res.redirect("/messages")
            })
        })

    app.route("/messages/:message_id")
        .get(function(req, res) {

            const query = `select * from sms_master.messages where id=?`,
                params = [req.params.message_id]

            client.execute(query, params, function(err, result) {
                assert.ifError(err)
                admin = result.rows[0]
                res.render('messages/new', {
                    layout: "bulkSMS",
                    session: req.session,
                    status: "Online",
                    page: "Registration",
                    back: "Front Office",
                    form: {
                        title: "Edit " + admin.title,
                        action: "",
                        method: "post",
                        fields: [{
                            name: "title",
                            placeholder: "What is the email of the admin?",
                            type: "text",
                            value: admin.title
                        }, {
                            name: "content",
                            placeholder: "What is the admin called?",
                            type: "text",
                            value: admin.content
                        }]
                    }
                });

            })

        })
        .post(function(req, res) {

            client.batch([{
                query: `INSERT INTO sms_master.messages (id, title, content) VALUES (?, ?, ?);`,
                params: [req.params.message_id, req.body.title, req.body.content]
            }], function(err, result) {
                res.redirect("/messages")
            })
        })

}
