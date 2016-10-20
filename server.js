const cassandra = require('cassandra-driver');
const assert = require("assert")
const async = require("async")
const colors = require('colors');
const morgan = require("morgan");
const moment = require("moment")
const session = require('express-session');
const CassandraStore = require("cassandra-store");
const fs = require('fs');
const expressValidator = require('express-validator');
var exphbs = require('express-handlebars');
var minifyHTML = require('express-minify-html');
var bodyParser = require('body-parser')

console.log("starting school engine".blue)

const contactPoint2 = process.env.OPENSHIFT_CASSANDRA_DB_HOST + ":" + process.env.OPENSHIFT_CASSANDRA_NATIVE_TRANSPORT_PORT

var connectionOptions = {
    contactPoints: [(process.env.OPENSHIFT_CASSANDRA_DB_HOST ? contactPoint2 : "localhost")],
    keyspace: 'system'
};

var client = new cassandra.Client(connectionOptions);

// // catch logs
// client.on('log', function(level, className, message, furtherInfo) {
//     console.log('log event: %s -- %s', level, message);
// });




var id = cassandra.types.Uuid; //new uuid v4 .random()
var timeId = cassandra.types.TimeUuid //new instance based on current date timeId.now
function log(err, results) {
    console.log(JSON.stringify((results || err), null, "\t"))
}


const express = require("express")
var formidable = require('express-formidable');

const app = express()

app.use(express.static("./assets"))

// You can set morgan depending on your environment
if (app.get('env') == 'production') {
    app.use(morgan('common', {
        skip: function(req, res) {
            return res.statusCode < 400
        },
        stream: __dirname + '/../morgan.log'
    }));
} else {
    app.use(morgan('dev'));
}

// capture url encoded forms and other
app.use(bodyParser.urlencoded({ extended: false }))

// capture multipart forms
app.use(formidable.parse({
    uploadDir: "./assets/uploads/"
}));

// node validate req.body
app.use(expressValidator())

sessionStoreOptions = {
    "table": "sms_master.user_sessions",
    "client": client
}

app.use(session({
    secret: '2C44-4D44-WppQ38S',
    resave: true,
    saveUninitialized: true,
    store: new CassandraStore(sessionStoreOptions),
}));

app.use(function(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next()
});

app.use(minifyHTML({
    override: true,
    htmlMinifier: {
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeAttributeQuotes: true,
        removeEmptyAttributes: true,
        minifyJS: true
    }
}));

app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    extname: 'handlebars'
}));

app.set('view engine', 'handlebars');


const port = process.env.OPENSHIFT_NODEJS_PORT || 80
const ip = process.env.OPENSHIFT_NODEJS_IP || "localhost"



require("./bulkSMS")(app)

require("./views/admins/server.js")(app)
require("./views/messages/server.js")(app)
require("./views/new_message/server.js")(app)
require("./views/org_details/server.js")(app)

app.listen(port, function() {
    console.log('Example app listening on port ${port}!');
});
