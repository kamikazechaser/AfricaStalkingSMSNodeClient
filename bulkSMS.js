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
    if (req.session)
        return next();
    else
        return res.redirect("/")
};



module.exports = function(app) {


    // be the last thing
    app.route("/")
        .get((req, res) => {
            res.render("logins/index", {
                layout: false,
                userType: "welcome..."
            });
        })
        .post((req, res) => {
            console.log(req.body)

            const query = `select * from sms_master.admins where user_name=? ALLOW FILTERING`;
            var params = [req.body.username]

            client.execute(query, params, function(err, result) {
                console.log(err)
                console.log(result)

                if (result.rows[0]) {
                    // chack if passwords are same
                    if (result.rows[0].password == req.body.password) {
                        // assign session and move to dashboard
                        //set the req object
                        req.session.user = result.rows[0].full_names;
                        req.session.username = req.body.username;
                        req.session.p_pic = (result.rows[0].p_pic || "Profile_avatar_placeholder_large.png");
                        req.session.id = result.rows[0].id;
                        if (result.rows[0].id instanceof timeId) {
                            req.session.createdAt = moment(result.rows[0].id.getDate()).fromNow()
                        } else {
                            req.session.createdAt = "for some time now"
                        }

                        // send to the next page and it will be available
                        res.redirect("/contacts")
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

    //contacts
    app.get("/contacts", auth, (req, res) => {

        const query = `select * from sms_master.contacts`;

        client.execute(query, function(err, result) {
            assert.ifError(err);
            console.log(result.rows[0])
            var rows = []

            result.rows.map((row) => {
                row.view_link = ("/contacts/" + row.id)
                row.edit_link = ("/contacts/edit/" + row.id),
                    row.delete_link = ("/contacts/delete/" + row.id)
            })

            console.log(req.session.user)

            var renderData = {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Contacts",
                back: "Dashboard",
                fields: ["name", "phone numnber"],
                branches: result.rows,
                new: "/contacts/new",
                contacts: result.rows
            }

            res.render('contacts/list', renderData);
        });

    })

    app.get("/contacts/delete/:contact_id", auth, (req, res) => {

        const query = `delete from sms_master.contacts where id=?`;

        client.execute(query, [req.params.contact_id], function(err, result) {
            assert.ifError(err);
            res.redirect("/contacts")
        });

    })

    app.route("/contacts/new")
        .get(function(req, res) {
            // get all the avalaible groups
            client.execute("select * from sms_master.groups", function(err, results) {
                var groups = []
                results.rows.map((row) => groups.push({
                    value: row.id,
                    text: row.name
                }))
                res.render('groups/new', {
                    layout: "bulkSMS",
                    session: req.session,
                    status: "Online",
                    page: "Registration",
                    back: "Front Office",
                    new: "/branches/new",
                    form: {
                        title: "Add new contact",
                        action: "",
                        method: "post",
                        fields: [{
                            name: "Name",
                            placeholder: "What is the contact called?",
                            type: "text"
                        }, {
                            name: "Telephone Number",
                            placeholder: "What is the phone number of the contact?",
                            type: "text"
                        }, {
                            name: "Select groups",
                            select: true,
                            multiple: "multiple",
                            selects: groups
                        }]
                    }
                });
            })

        })
        .post(function(req, res) {
            console.log(req.body)
                // save to the db, return to the list
            console.log(req.body)

            // read the values and validate, post to the db or reply with errors
            const contact_id = timeId.now()

            client.batch([{
                query: `INSERT INTO sms_master.contacts (id,user_name, phone_number) VALUES (?, ?, ?);`,
                params: [contact_id, req.body.Name, req.body["Telephone Number"]]
            }], function(err, result) {
                res.redirect("/contacts")
                    // add the user to the specified groups
                    // assign the groups. later. not exactly important 

                req.body["Select groups"].map((group) => {
                    var assign = [{
                        query: `INSERT INTO sms_master.groups_per_contact (contact,contact_name, group) VALUES (?, ?, ?);`,
                        params: [contact_id, req.body.Name, group]
                    }]

                    client.batch(assign, function(err, result) {
                        assert.ifError(err);

                        console.log(result.rows)

                    });
                })
            })
        })



    // require("./views/server")(app)


    app.route("/contacts/:contact_id")
        .get(function(req, res) {
            // fetch this contact from the db. and also fetch his profile. parrallel
            // also fetch his groups and sgow them there
            // also also all his group
            var contact = {
                user: {}
            }

            async.series([
                function(next) {
                    var query = `select * from sms_master.contacts where id=?`,
                        params = [req.params.contact_id]

                    client.execute(query, params, function result(err, results) {
                        // console.log(results)
                        contact.user = results.rows[0];
                        next()
                    })
                },
                function(next) {
                    var query = `select * from sms_master.groups;`

                    client.execute(query, function result(err, results) {
                        console.log(results.rows)
                        results.rows.map((row) => row.identifier = row.id)
                        results.rows.map((row) => row.asign_link = ("/assign-group/" + contact.user.id + "/" + contact.user.user_name + "/group/" + row.id + "/" + row.name))
                        contact.availableGroups = results.rows;
                        next()
                    })
                },
                function(next) {
                    var query = `select * from sms_master.groups_per_contact where contact=?;`
                    var params = [req.params.contact_id]

                    client.execute(query, params, function result(err, results) {
                        console.log(results.rows)
                        results.rows.map((row) => row.de_asign_link = ("/de-assign-group/" + contact.user.id + "/" + contact.user.user_name + "/group/" + row.group + "/" + row.group_name))
                        results.rows.map((row) => row.identifier = row.group)

                        // find the names of the groups
                        async.eachSeries(results.rows, function(group, complete) {
                            console.log(group)
                            client.execute("select * from sms_master.groups where id=?", [group.group], (err, results) => {
                                assert.ifError(err)
                                var groupDetails = results.rows[0]
                                console.log("group details ", groupDetails)
                                group.name = groupDetails.name
                                complete()
                            })
                        }, (err) => {
                            contact.joinedGroups = results.rows;
                            console.log(contact.joinedGroups)
                            next()
                        })
                    })
                }
            ], function done(argument) {
                console.log("done")
                console.log(contact)

                res.render('contacts/single', {
                    layout: "bulkSMS",
                    contact: contact
                });
            })

        })


    app.route("/contacts/edit/:contact_id")
        .get(function(req, res) {

            var query = `select * from sms_master.contacts where id=?`,
                params = [req.params.contact_id]

            client.execute(query, params, function result(err, results) {
                console.log(results)
                var user = results.rows[0];

                // fetch the groups the user is in
                var query2 = `select * from sms_master.groups_per_contact where contact=? allow filtering`,
                    params2 = [req.params.contact_id]


                var thing = {}
                async.parallel([
                    function(next) {
                        client.execute(query2, params2, function result(err, results) {
                            assert.ifError(err)
                            console.log("groups_per_contact", results.rows)
                            thing.contained = results.rows
                            next()
                        })
                    },
                    function(next) {
                        client.execute("select * from sms_master.groups", function result(err, results) {
                            assert.ifError(err)
                            console.log("groupst", results.rows)
                            thing.availableGroups = results.rows
                            next()
                        })
                    }
                ], function complete(error) {
                    // check what groups are selected. loops
                    var mygroups = []
                    thing.availableGroups.map((Agroup) => {
                        var found = false
                        thing.contained.map((contained) => {
                            console.log(Agroup.id, contained.group)
                            if (Agroup.id.equals(contained.group)) {
                                found = true
                            }
                        })
                        if (found == true) {
                            mygroups.push({
                                value: Agroup.id,
                                text: Agroup.name,
                                selected: "selected"
                            })
                        } else {
                            mygroups.push({
                                value: Agroup.id,
                                text: Agroup.name
                            })
                        }
                    })

                    console.log(mygroups)

                    res.render('groups/new', {
                        layout: "bulkSMS",
                        session: req.session,
                        status: "Online",
                        page: "Registration",
                        back: "Front Office",
                        new: "/branches/new",
                        form: {
                            title: "Add new contact",
                            action: "",
                            method: "post",
                            fields: [{
                                name: "Name",
                                placeholder: "What is the contact called?",
                                type: "text",
                                value: user.user_name
                            }, {
                                name: "Telephone Number",
                                placeholder: "What is the phone number of the contact?",
                                type: "text",
                                value: user.phone_number
                            }, {
                                name: "Select groups",
                                select: true,
                                multiple: "multiple",
                                selects: mygroups
                            }]
                        }
                    });
                })
            })
        })

    .post(function(req, res) {
        // read the values and validate, post to the db or reply with errors
        const contact_id = req.params.contact_id

        // remove the records where the contact exists

        client.batch([{
            query: `INSERT INTO sms_master.contacts (id,user_name, phone_number) VALUES (?, ?, ?);`,
            params: [contact_id, req.body.Name, req.body["Telephone Number"]]
        }], function(err, result) {
            res.redirect("/contacts")
                // add the user to the specified groups
                // assign the groups. later. not exactly important 

            // remove him from the groups records
            client.execute("delete from sms_master.groups_per_contact where contact=?", [contact_id], function(err, result) {
                assert.ifError(err);
                console.log(result.rows)

                // insert 
                req.body["Select groups"].map((group) => {
                    var assign = [{
                        query: `INSERT INTO sms_master.groups_per_contact (contact,contact_name, group) VALUES (?, ?, ?);`,
                        params: [contact_id, req.body.Name, group]
                    }]

                    client.batch(assign, function(err, result) {
                        assert.ifError(err);
                        console.log(result.rows)
                    });
                })
            });


        })
    })



    //groups
    app.route("/groups/new")
        .get(auth, (req, res) => {

            res.render('groups/new', {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Registration",
                back: "Front Office",
                new: "/branches/new",
                form: {
                    title: "Add new group",
                    action: "",
                    method: "post",
                    fields: [{
                        name: "Name",
                        placeholder: "What is the group called?",
                        type: "text"
                    }]
                }
            });

        })
        .post(auth, (req, res) => {
            console.log(req.body)

            // read the values and validate, post to the db or reply with errors

            client.batch([{
                query: `INSERT INTO sms_master.groups (id,name) VALUES (?, ?);`,
                params: [timeId.now(), req.body.Name]
            }, ], function(err, result) {
                res.redirect("/groups")
            })

        })

    //groups
    app.get("/groups", auth, (req, res) => {

        const query = `select * from sms_master.groups`;

        client.execute(query, function(err, result) {
            assert.ifError(err);
            console.log(result.rows[0])
            var rows = []

            result.rows.map((row) => {
                row.view_link = ("/groups/" + row.id)
                row.edit_link = ("/groups/edit/" + row.id),
                    row.delete_link = ("/groups/delete/" + row.id)
            })

            console.log(req.session.user)

            var renderData = {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Groups",
                back: "Dashboard",
                fields: ["name", "phone number"],
                branches: result.rows,
                new: "/groups/new",
                groups: result.rows
            }

            res.render('groups/list', renderData);
        });

    })


    app.get("/groups/delete/:group_id", auth, (req, res) => {

        const query = `delete from sms_master.groups where id=?`;

        client.execute(query, [req.params.group_id], function(err, result) {
            assert.ifError(err);
            res.redirect("/groups")
        });

    })


    //groups
    app.get("/groups/:group_id", auth, (req, res) => {

        const query = `select * from sms_master.groups_per_contact where group=? allow filtering`,
            params = [req.params.group_id]

        client.execute(query, params, function(err, result) {
            assert.ifError(err);

            console.log(result.rows)

            var renderData = {
                layout: "bulkSMS",
                session: req.session,
                status: "Online",
                page: "Groups",
                back: "Dashboard",
                fields: ["name", "phone number"],
                branches: result.rows,
                new: "/groups/new",
                contacts: result.rows
            }

            res.render('groups/single', renderData);
        });

    })


    // assign contact to group
    //groups
    app.get("/assign-group/:contact_id/:contact_name/group/:group_id/:group_name", auth, (req, res) => {

        var assign = [{
            query: `INSERT INTO sms_master.groups_per_contact (contact,contact_name, group, group_name) VALUES (?, ?, ?, ?);`,
            params: [req.params.contact_id, req.params.contact_name, req.params.group_id, req.params.group_name]
        }]

        client.batch(assign, function(err, result) {
            assert.ifError(err);

            console.log(result.rows)

            res.redirect('/contacts/' + req.params.contact_id);
        });

    })

    // remove contact from a group
    app.get("/de-assign-group/:contact_id/:contact_name/group/:group_id/:group_name", auth, (req, res) => {

        var assign = [{
            query: `delete from sms_master.groups_per_contact where contact=? and group=?;`,
            params: [req.params.contact_id, req.params.group_id]
        }]

        client.batch(assign, function(err, result) {
            assert.ifError(err);

            console.log(result.rows)

            res.redirect('/contacts/' + req.params.contact_id);
        });

    })

}
