const cassandra = require('cassandra-driver');
const assert = require("assert")
const async = require("async")
const cassie = require("./query_creator")

// var contactPoints = ["192.241.151.182", "192.241.152.171"],
var contactPoints = ["127.0.0.1"]

var connectionOptions = {
    contactPoints: contactPoints,
    keyspace: 'system'
};

var creator = function() {
    var client = new cassandra.Client(connectionOptions);

    var id = cassandra.types.Uuid; //new uuid v4 .random()
    var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now

    var structure = [
        cassie.tableMaker({
            keyspace: "sms_master",
            table: "user_sessions",
            record: {
                sid: "text",
                expires: "timestamp",
                session: "text"
            },
            primary_keys: ["sid"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "admins",
            record: {
                user_name: "text",
                password: "text"
            },
            primary_keys: ["user_name"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "contacts",
            record: {
                id: "TimeUuid",
                organisation: "timeuuid",
                phone_number: "text",
                user_name: "text"
            },
            primary_keys: ["id", "organisation"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "groups",
            record: {
                id: "TimeUuid",
                organisation: "timeuuid",
                name: "text"
            },
            primary_keys: ["id", "organisation"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "groups_per_contact",
            record: {
                contact: "TimeUuid",
                group: "TimeUuid",
                contact_name: "text",
                group_name: "text",
                id: "TimeUuid"
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "messages",
            record: {
                id: "TimeUuid",
                content: "text",
                title: "text",
                organisation: "timeuuid"
            },
            primary_keys: ["id", "organisation"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "org_details",
            record: {
                id: "TimeUuid",
                key: "text",
                location: "text",
                name: "text",
                username: "text"
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "user_accounts",
            record: {
                user_name: "TimeUuid",
                password: "text",
                session_token: "text"
            },
            primary_keys: ["user_name"]
        }),


        cassie.tableMaker({
            keyspace: "sms_master",
            table: "user_profiles",
            record: {
                user_name: "text",
                full_names: "text",
                id: "timeuuid",
                p_pic: "text",
                telephone: "text"
            },
            primary_keys: ["user_name"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "registering_users",
            record: {
                id: "timeuuid",
                email: "varchar",
                name: "text",
                gender: "text",
                password: "text"
            },
            primary_keys: ["id", "email"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "organisations",
            record: {
                id: "timeuuid",
                name: "text",
                locations: "text"
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "admins_for_organisation",
            record: {
                user_name: "text",
                organisation: "timeuuid"
            },
            primary_keys: ["user_name"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "sent_messages",
            record: {
                id: "timeuuid",
                title: "text",
                message: "text"
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "groups_sent_messages",
            record: {
                id: "timeuuid",
                group: "timeuuid",
                message: "text"
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "message_instance",
            record: {
                id: "timeuuid",
                admin: "text"
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "quick_sent_messages",
            record: {
                id: "timeuuid",
                cost: "float",
                instance: "timeuuid",
                message: "text",
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "contacts_quick_messages",
            record: {
                id: "timeuuid",
                quick_message: "timeuuid",
                contact: "timeuuid"
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "payments",
            record: {
                organisation: "timeuuid",
                id: "timeuuid",
                ammount: "float",
                account: "text"
            },
            primary_keys: ["organisation"]
        })

    ]

    console.log(structure)

    client.execute(`CREATE KEYSPACE IF NOT EXISTS sms_master WITH REPLICATION = {
            'class' : 'SimpleStrategy',
            'replication_factor' : 3
        };`, (err, results) => {
        assert.ifError(err)

        var funcs = []

        async.filter(structure, (command, nextCB) => {


            funcs.push(function(next) {
                client.execute(command, function(err, results) {
                    assert.ifError(err)
                    next()
                })
            })

            nextCB()

            // console.log(command)
        }, function(argument) {
            console.log("completed creating the tables")
        })

        async.parallel(funcs, (err) => console.log)
    })


}

creator()
