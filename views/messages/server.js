const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now

module.exports = function(app) {
    const client = app.locals.db
    var auth = app.locals.auth

    app.get("/messages", auth, (req, res) => {

        const query = `select * from sms_master.messages where organisation = ? ALLOW FILTERING`;

        client.execute(query, [req.session.org_id], function(err, result) {
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
                query: `INSERT INTO sms_master.messages (id, title, content, organisation) VALUES (?,?, ?, ?);`,
                params: [timeId.now(), req.body["Title"], req.body["Content"], req.session.org_id]
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
