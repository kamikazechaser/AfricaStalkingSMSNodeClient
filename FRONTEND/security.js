var https = require('https')
var http = require('http')
var express = require('express')
var fs = require('fs')

var app = express()

app.get("/", (req, res) => {
    res.send("hello world!")
})

// http.createServer(function(req, res) {
//     res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
//     res.end();
// }).listen(8000);

const port = 8000

app.listen(port, (err) => {
    console.log("server started on " + port)
})

https.createServer({
    key: fs.readFileSync("/etc/letsencrypt/archive/sabek.co.ke/privkey1.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/archive/sabek.co.ke/fullchain1.pem"),
    ca: fs.readFileSync("/etc/letsencrypt/archive/sabek.co.ke/chain1.pem")
}, app).listen(443);
