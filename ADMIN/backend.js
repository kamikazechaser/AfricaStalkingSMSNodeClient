const cassandra = require('cassandra-driver');
const assert = require("assert")
const async = require("async")
const colors = require('colors');
const morgan = require("morgan");
const moment = require("moment")
const session = require('express-session');
const CassandraStore = require("cassandra-store");
const expressValidator = require('express-validator');
var exphbs = require('express-handlebars');
var minifyHTML = require('express-minify-html');
var bodyParser = require('body-parser')
var ip = require("ip");
var subdomain = require('express-subdomain');

// var contactPoints = ["192.241.151.182", "192.241.152.171"]
var contactPoints = ["127.0.0.1"]

var connectionOptions = {
    contactPoints: contactPoints,
    keyspace: 'sms_master'
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


var express = require('express');
var formidable = require('express-formidable');

const app = express()

app.use(express.static("./assets"))

app.use(morgan('dev'));

// capture url encoded forms and other
app.use(bodyParser.urlencoded({
    extended: false
}))

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


// disable cache in all browsers
app.use(function(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next()
});

// trust proxy
app.set('trust proxy', true);

// minify all html output
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


const port = 8081

// Authentication and Authorization Middleware
var auth = function(req, res, next) {
    if (req.session.username)
        return next();
    else
        res.redirect("/")
};

//attempt to connect to the database
client.connect((err) => {
    assert.ifError(err)

    console.log("Connected successfully to the cluster")

    // set the client to app.locals and init bot
    var janitor = require("../FRONTEND/bot.js")(app)

    app.locals.db = client
    app.locals.auth = auth
    app.locals.auth = auth
    app.locals.janitor = janitor

    require("./admin")(app)


    app.get("/logout", (req, res) => {
        req.session.destroy(function(err) {
            res.redirect("/")
        })
    })


    // not found page
    app.get('*', function(req, res) {
        res.render('404', {
            layout: false
        });
    });

    app.listen(port, function() {
        console.log('Example app listening on port ' + port + "!");
        janitor.sendMessage("21649399", 'Admin app listening on port ' + ip.address() + ":" + port + "!")
    });

    // catch errors
    process.on('uncaughtException', function(err) {
        console.error(err);
        console.log("Node NOT Exiting...");
        janitor.sendMessage("21649399", "uncaughtException Cought!! Node Exiting..." + new Date() + "")
        janitor.sendMessage("21649399", (err ? err.stack : "empty error object"))
    });
})
