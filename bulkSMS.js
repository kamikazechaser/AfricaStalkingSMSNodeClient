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
    // be the last thing
    app.route("/login")
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
                        async.parallel([
                            function(next) {
                                client.execute("select * from admins_for_organisation where user_name=?", [req.body.username], (err, admins_for_organisations) => {
                                    assert.ifError(err)
                                        // check the number of orgs, start with only one and send there direct
                                    console.log(admins_for_organisations.rows)
                                    var sessionData = admins_for_organisations.rows[0]

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

                                    req.session.user_id = sessionData.user_name
                                    req.session.org_id = sessionData.organisation
                                    client.execute("select * from organisations where id=?", [req.session.org_id], (err, organisation) => {
                                        assert.ifError(err)
                                        console.log("organisation details", organisation.rows)
                                        req.session.org_name = organisation.rows[0].name;
                                        next()
                                    })

                                })
                            }
                        ], function(err) {
                            res.redirect("/dashboard")
                        })


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

        const query = `select * from sms_master.contacts where organisation=? ALLOW FILTERING`;

        client.execute(query, [req.session.org_id], function(err, result) {
            assert.ifError(err);
            console.log(result.rows[0])
            var rows = []

            result.rows.map((row) => {
                row.view_link = ("/contacts/" + row.id)
                row.edit_link = ("/contacts/edit/" + row.id)
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

    app.get("/dashboard", auth, (req, res) => {
        const organisation = req.session
        console.log("organisation", organisation)
        var stats = {}
        async.parallel([
            function(next) {
                client.execute("select count(*) from admins_for_organisation where organisation=? ALLOW FILTERING;", [req.session.org_id], (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.admin_count = results.rows[0].count
                    next()
                })
            },
            function(next) {
                client.execute("select count(*) from contacts where organisation=? ALLOW FILTERING;", [req.session.org_id], (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.contacts_count = results.rows[0].count
                    next()
                })
            },
            function(next) {
                client.execute("select count(*) from groups where organisation=? ALLOW FILTERING;", [req.session.org_id], (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.groups_count = results.rows[0].count
                    next()
                })
            },
            function(next) {
                client.execute("select count(*) from messages where organisation=? ALLOW FILTERING;", [req.session.org_id], (err, results) => {
                    assert.ifError(err)
                        // console.log(results)
                    stats.messages_count = results.rows[0].count
                    next()
                })
            },
            function(next) {
                client.execute("select * from contacts where organisation = ? ALLOW FILTERING;", [req.session.org_id], (err, results) => {
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
                        placeholder: "Good morning, hey, Praise the lord....."
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

    app.post("/quickmessage", (req, res) => {
        console.log(req.body)


        var numbers = []
        var convertedNumbers = []
        if (req.body["Select Contacts"] instanceof Array) {
            console.log(req.body["Select Contacts"])
            console.log("an array was sent")
            req.body["Select Contacts"].map(function(contact) {
                if (Number(contact)) {
                    console.log("selected " + contact)
                    numbers.push(contact)
                }
            })
            console.log(numbers)
        } else {
            console.log("a single number was sent")
            numbers.push(req.body["Select Contacts"])
        }

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
                        message: req.body["Subject"] + "\n\n" + req.body["Prefix"] + " " + firstname + ",\n " + req.body["Enter message"] + "\n\n"
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
                    assert.ifError(err)
                    res.redirect("/sendResults/" + instance.id)

                })

            })


        function convert(number) {
            if (Number(number)) {
                var phoneNumber = phoneUtil.parse(number, 'KE');
                return phoneUtil.format(phoneNumber, PNF.INTERNATIONAL)
            }
        }
    })


    app.get("/sendResults/:instance_id", auth, (req, res) => {

        const query = `select * from message_instance where id=?`;
        var instance = {}

        client.execute(query, [req.params.instance_id], function(err, result) {
            assert.ifError(err);
            // console.log(result)
            instance.details = result.rows[0]
                // get count of messages in that instance
            async.parallel([
                function countMessages(next) {
                    const query = `select count(*) from quick_sent_messages where instance=? allow FILTERING`;

                    client.execute(query, [req.params.instance_id], function(err, result) {
                        assert.ifError(err)
                        console.log(result)
                        instance.messages_number = result.rows[0].count
                        next()
                    })
                },
                function getTotalCost(next) {
                    const query = `select * from quick_sent_messages where instance=? allow FILTERING`;

                    client.execute(query, [req.params.instance_id], { prepare: true }, function(err, result) {
                        assert.ifError(err)
                        console.log(result)
                        var sum = 0
                        result.rows.map((row) => {
                            sum = Number(sum) + Number(row.cost)
                        })
                        instance.messages_sum = accounting.toFixed(Number(sum), 2);
                        next()
                    })
                }
            ], function(err) {
                res.render('new_message/send_report', {
                    session: req.session,
                    instance: instance,
                    layout: "bulkSMS"
                });
            })


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

            // read the values and validate, post to the db or reply with errors
            const contact_id = timeId.now()

            client.batch([{
                query: `INSERT INTO sms_master.contacts (id,organisation,user_name, phone_number) VALUES (?,?, ?, ?);`,
                params: [contact_id, req.session.org_id, req.body.Name, req.body["Telephone Number"]]
            }], function(err, result) {
                assert.ifError(err)
                console.log(req.body)
                res.redirect("/contacts")
                    // add the user to the specified groups
                    // assign the groups. later. not exactly important 
                if (req.body["Select groups"] instanceof Array) {
                    req.body["Select groups"].map((group) => {
                        var assign = [{
                            query: `INSERT INTO sms_master.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
                            params: [timeId.now(), contact_id, req.body.Name, group]
                        }]

                        client.batch(assign, function(err, result) {
                            assert.ifError(err);
                        });
                    })
                } else {
                    var assign = [{
                        query: `INSERT INTO sms_master.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
                        params: [timeId.now(), contact_id, req.body.Name, req.body["Select groups"]]
                    }]

                    client.batch(assign, function(err, result) {
                        assert.ifError(err);
                    });
                }

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

        var query = {
            query: `INSERT INTO sms_master.contacts (id,user_name, phone_number) VALUES (?, ?, ?);`,
            params: [req.params.contact_id, req.body.Name, req.body["Telephone Number"]]
        }

        console.log(query)

        client.batch([query], function(err, result) {
            res.redirect("/contacts")
            assert.ifError(err)
            console.log("inserted the contact again")
                // add the user to the specified groups
                // assign the groups. later. not exactly important 

            // remove him from the groups records
            client.execute("delete from sms_master.groups_per_contact where contact=?", [contact_id], function(err, result) {
                assert.ifError(err);

                // insert 
                req.body["Select groups"].map((group) => {
                    var assign = [{
                        query: `INSERT INTO sms_master.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
                        params: [timeId.now(), contact_id, req.body.Name, group]
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
                query: `INSERT INTO sms_master.groups (id,name,organisation) VALUES (?, ?, ?);`,
                params: [timeId.now(), req.body.Name, req.session.org_id]
            }, ], function(err, result) {
                res.redirect("/groups")
            })

        })

    //groups
    app.get("/groups", auth, (req, res) => {

        const query = `select * from sms_master.groups where organisation=? allow filtering`;

        client.execute(query, [req.session.org_id], function(err, result) {
            assert.ifError(err);
            console.log(result.rows[0])
            var rows = []

            result.rows.map((row) => {
                row.view_link = ("/groups/" + row.id)
                row.edit_link = ("/groups/edit/" + row.id)
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


// africasTalking 
// We need this to build our post string
var querystring = require('querystring');
var https = require('https');
// Your login credentials

// function getUsernamePassword(id, cb) {
//     client.execute("select * from sms_master.org_details;", function(err, results) {
//         console.log(results)
//         assert.ifError(err)
//             // body...
//         cb(err, [results.rows[0].username, results.rows[0].key])
//     })
// }


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


var querystring = require('querystring');
var request = require('request');

var form = {
    username: "Branson",
    apikey: "908b353c4496d48ab1167ee4d2ffae1477059578",
};

var formData = querystring.stringify(form);
var contentLength = formData.length;

request({
    headers: {
        'Content-Length': contentLength,
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    uri: 'http://mobilesasa.com/accountbalance.php',
    body: formData,
    method: 'POST'
}, function(err, res, body) {
    if (!err && res.statusCode == 200) {
        console.log(body)
    }
});
