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
    contactPoints: ["192.241.151.182", "192.241.152.171"],
    keyspace: 'sms_master'
};

var client = new cassandra.Client(connectionOptions);


const masterProd = "d9188870-9ac4-11e6-ba06-e72132bc4668"
    // get all the clients

// add them all to the master group

// move everyone to master

client.execute("select * from sms_master.contacts", (err, results) => {
    assert.ifError(err)
    results.rows.map((row) => {
        var assign = [{
            query: `INSERT INTO sms_master.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
            params: [timeId.now(), row.id, row.user_name, masterLocal]
        }, {
            query: `INSERT INTO sms_masterf.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
            params: [timeId.now(), row.id, row.user_name, masterProd]
        }]

        client.batch(assign, function(err, result) {
            assert.ifError(err);
            // console.log(result.rows)
            console.log("sorted")
        });
    })
})

// var organisation = "37dfc5c0-9abc-11e6-a62e-0a6f3f26f5ce"
// var batch = []
//     // add organisation to get instances of an organisation
//     // client.execute("ALTER TABLE sms_master.message_instance ADD organisation timeuuid;", (err, results) => {
//     // assert.ifError(err)
//     // console.log("added the collumn")

// client.execute("select * from sms_master.message_instance", (err, results) => {
//     assert.ifError(err)

//     results.rows.map((row) => {

//         const instance = {
//             id: row.id,
//             admin: row.admin,
//             organisation: organisation
//         }

//         batch.push(cassie.insertMaker({
//             keyspace: "sms_master",
//             table: "message_instance",
//             record: instance
//         }))
//     })

//     client.batch(batch, (err, results) => {
//         assert.ifError(err)
//         console.log("the data has been updated to the cluster succesfully")
//     })
// })

// })

// remove all the duplicate records in

// client.execute("select * from sms_master.groups_per_contact", (err, results) => {
//     assert.ifError(err)
//     console.log(results.rows)
// })

// client.execute("select * from contacts;", (err, results) => {
//     assert.ifError(err)
//         // console.log(results.rows)
//     async.each(results.rows, (row, next) => {
//         // console.log(row.phone_number)

//         client.execute("select * from contacts where phone_number = ? ALLOW FILTERING;", [row.phone_number], (err, results) => {
//             assert.ifError(err)
//             if (results.rows.length > 1) {
//                 console.log(row.phone_number + " has " + results.rows.length + " duplicates ")
//                 async.series([
//                     function(nextDuplicate) {
//                         // map through the duplicates and delete them all
//                         async.map(results.rows, (err, next) => {
//                             client.execute("delete from sms_master.groups_per_contact where id=?", [row.id], function(err, result) {
//                                 assert.ifError(err)
//                                 console.log("deleted the record" + row.id + " for " + row.phone_number)
//                             })
//                         }, nextDuplicate)
//                     },
//                     function(nextFUnction) {
//                         var assign = [{
//                             query: `INSERT INTO sms_master.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
//                             params: [results.rows[0].id, results.rows[0].contact, results.rows[0].contact_name, results.rows[0].group]
//                         }]

//                         client.batch(assign, function(err, result) {
//                             assert.ifError(err);
//                             console.log(result.rows)
//                             nextFUnction
//                         });
//                     }
//                 ], next)
//             }
//             next()
//         })
//     })
// })

// client.execute("select * from contacts where phone_number = ? ALLOW FILTERING;", [number], (err, results) => {
//     assert.ifError(err)
//         // store the thing to be batched
//     var batch = []

//     // remove duplicates, best to move the data to a new table with composite keys
//     if (results.rows.length > 1) {
//         console.log(number + " has " + results.rows.length + " duplicates ")
//             // delete and insert again to get only one contact in that table

//         async.each(results.rows, (row, next) => {
//             client.execute("delete from sms_master.groups_per_contact where contact=?", [row.id], function(err, result) {
//                 assert.ifError(err)
//                 console.log("deleted the record" + row.id + " for " + number)
//                 next()
//             })
//         }, function(argument) {

//             // insert it again using the first Id in memory
//             var assign = [{
//                 query: `INSERT INTO sms_master.groups_per_contact (id,contact,contact_name, group) VALUES (?,?, ?, ?);`,
//                 params: [results.rows[0].id, results.rows[0].contact, results.rows[0].contact_name, results.rows[0].group]
//             }]

//             client.batch(assign, function(err, result) {
//                 assert.ifError(err);
//                 console.log(result.rows)
//             });
//         })
//     }
// })
