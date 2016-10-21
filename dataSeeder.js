const cassandra = require('cassandra-driver');
const assert = require("assert")
const async = require("async")
const cassie = require("./query_creator")

const contactPoint2 = process.env.OPENSHIFT_CASSANDRA_DB_HOST + ":" + process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT

var connectionOptions = {
    contactPoints: [(process.env.OPENSHIFT_CASSANDRA_DB_HOST ? contactPoint2 : "localhost")],
    keyspace: 'system'
};

var client = new cassandra.Client(connectionOptions);

var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now

var cleaner = function(cb) {
    // clear the db contents first
    const schoolmaster = `SELECT table_name FROM system_schema.tables WHERE keyspace_name = 'schoolmaster';`

    client.execute(schoolmaster, function(err, result) {
        assert.ifError(err);
        console.log('truncating the schoolmaster keyspace');
        // console.log(result.rows)
        async.eachSeries(result.rows, function iteratee(row, next) {
            var truncater = "truncate table schoolmaster." + row.table_name
            client.execute(truncater, function(err, result) {
                assert.ifError(err);
                console.log("truncated " + row.table_name)
                setTimeout(next, 600)
            });
        }, function() {
            console.log("DB is now clean!!!!!")
            cb()
        })

    });
}


var creator = function() {
    // constants
    const group = {
        user_name: "sirbranson67@hmail.com",
        password: "a10101995"
    }


    var structure = [
        // administration
        cassie.insertMaker({
            keyspace: "sms_master",
            table: "admins",
            record: group
        })

    ]

    client.batch(structure, function(err, results) {
        assert.ifError(err)
        console.log("batch was successfull")
    })
}

cleaner(creator)
