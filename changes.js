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
var querystring = require('querystring');
var request = require('request');


var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now


const contactPoint2 = process.env.OPENSHIFT_CASSANDRA_DB_HOST + ":" + process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT

var connectionOptions = {
    contactPoints: [(process.env.OPENSHIFT_CASSANDRA_DB_HOST ? contactPoint2 : "localhost")],
    keyspace: 'sms_master'
};

var client = new cassandra.Client(connectionOptions);


// const masterLocal = "995917d0-9ac0-11e6-84b9-26c25ec4d711"
// const masterProd = "d9188870-9ac4-11e6-ba06-e72132bc4668"
// get all the clients

// add them all to the master group

// move everyone to master

// client.execute("select * from sms_master.contacts", (err, results) => {
//     assert.ifError(err)
//     results.rows.map((row) => {
//         var assign = [{
//             query: `INSERT INTO sms_master.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
//             params: [timeId.now(), row.id, row.user_name, masterLocal]
//         }, {
//             query: `INSERT INTO sms_masterf.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
//             params: [timeId.now(), row.id, row.user_name, masterProd]
//         }]

//         client.batch(assign, function(err, result) {
//             assert.ifError(err);
//             // console.log(result.rows)
//             console.log("sorted")
//         });
//     })
// })

var organisation = "670d6f20-9ac4-11e6-8632-e1ee75bf3901"
var batch = []
    // add organisation to get instances of an organisation
client.execute("ALTER TABLE sms_master.message_instance ADD organisation timeuuid;", (err, results) => {
    assert.ifError(err)
    console.log("added the collumn")

    client.execute("select * from sms_master.message_instance", (err, results) => {
        assert.ifError(err)

        results.rows.map((row) => {

            const instance = {
                id: row.id,
                admin: row.admin,
                organisation: organisation
            }

            batch.push(cassie.insertMaker({
                keyspace: "sms_master",
                table: "message_instance",
                record: instance
            }))
        })

        client.batch(batch, (err, results) => {
            assert.ifError(err)
            console.log("the data has been updated to the cluster succesfully")
        })
    })

})
