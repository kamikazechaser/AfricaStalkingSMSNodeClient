const cassandra = require('cassandra-driver');
const assert = require("assert")


var connectionOptions = {
    contactPoints: [("localhost")],
    keyspace: 'system'
};

var client = new cassandra.Client(connectionOptions);
