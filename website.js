const express = require("express")
const app = express.Router();
const assert = require("assert")
const async = require("async")
const cassandra = require('cassandra-driver');
const cassie = require("./query_creator")


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
          res.render("website/home", {
              layout: false
          });
        })
        .post((req, res)=>{
          console.log()

          // unique id for record
          req.body.id = timeId.now()

          var structure = [
              cassie.insertMaker({
                  keyspace: "sms_master",
                  table: "registering_users",
                  record: req.body
              })
          ]

          client.batch(structure, function(err, results) {
              assert.ifError(err)
              console.log("batch was successfull")
              // sent email verification page
              res.redirect("/verifypassword/" + req.body.email)
          })
        })

        app.route("/verifypassword/:email")
            .get((req, res) => {
              client.execute("select * from registering_users where email=? ALLOW FILTERING",[req.params.email],(err, results)=>{
                assert.ifError(err)
                res.render("website/verifypassword", {
                    layout: false,
                    header:"Hey " + results.rows[0].name + ","
                });
              })

            })
            .post((req, res)=>{
              console.log(req.body)
              client.execute("select * from registering_users where email=? ALLOW FILTERING",[req.params.email],(err, results)=>{
                assert.ifError(err)
                // check if thats the correct password
                console.log(results.rows[0].password, req.body.password)
                if(results.rows[0].password === req.body.password){
                  res.render("website/product_list", {
                      layout: false
                  });

                }else{
                  res.render("website/verifypassword", {
                      layout: false,
                      header:"Hey " + results.rows[0].name + ",",
                      error:"Wrong verification password!"
                  });
                }

              })
            })
}
