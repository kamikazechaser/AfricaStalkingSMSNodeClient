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


var connectionOptions = {
    contactPoints: ["192.241.151.182", "192.241.152.171"],
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


const ip = "localhost"
const port = 8080


require("./website")(app)


// Authentication and Authorization Middleware
var auth = function(req, res, next) {
    if (req.session.user_id && req.session.org_id)
        return next();
    else
        return res.redirect("/")
};

//attempt to connect to the database
client.connect((err) => {
    assert.ifError(err)

    console.log("Connected successfully to the cluester")

    // set the client to aoo.locals
    app.locals.db = client
    app.locals.auth = auth

    require("./bulkSMS")(app)


    require("./views/admins/server.js")(app)
    require("./views/messages/server.js")(app)
    require("./views/new_message/server.js")(app)
    require("./views/org_details/server.js")(app)

    app.get("/logout", (req, res) => {
        req.session.destroy(function(err) {
            res.redirect("/")
        })
    })

    app.listen(port, function() {
        console.log('Example app listening on port ' + port + "!");
    });
})
