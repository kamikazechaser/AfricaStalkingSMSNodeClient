var https = require('https')
var http = require('http')
var fs = require('fs')

http.createServer(function(req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(8000);

https.createServer({
    key: fs.readFileSync("/etc/letsencrypt/archive/sabek.co.ke/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/archive/sabek.co.ke/fullchain.pem"),
    ca: fs.readFileSync("/etc/letsencrypt/archive/sabek.co.ke/chain.pem")
}, app).listen(443);
