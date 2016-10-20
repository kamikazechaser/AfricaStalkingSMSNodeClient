const cassandra = require('cassandra-driver');
const assert = require("assert")
const async = require("async")
const cassie = require("./query_creator")

const contactPoint2 = process.env.OPENSHIFT_CASSANDRA_DB_HOST + ":" + process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT

var connectionOptions = {
    contactPoints: [(process.env.OPENSHIFT_CASSANDRA_DB_HOST ? contactPoint2 : "localhost")],
    keyspace: 'system'
};

var creator = function() {
    var client = new cassandra.Client(connectionOptions);

    var id = cassandra.types.Uuid; //new uuid v4 .random()
    var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now

    var structure = [

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "admins",
            record: {
                user_name: "text",
                password: "text",
                session_token: "text"
            },
            primary_keys: ["user_name"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "contacts",
            record: {
                id: "TimeUuid",
                phone_number: "text",
                user_name: "text"
            },
            primary_keys: ["id"]
        }),

        cassie.tableMaker({
            keyspace: "sms_master",
            table: "groups",
            record: {
                id: "TimeUuid",
                name: "text",
            },
            primary_keys: ["id"]
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
                title: "text"
            },
            primary_keys: ["id"]
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
