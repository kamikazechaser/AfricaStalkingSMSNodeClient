'use strict';

require('letsencrypt-express').create({

    server: 'staging'

    ,
    email: 'sirbranson67@gmail.com'

    ,
    agreeTos: true

    ,
    approveDomains: ['sabek.co.ke']

    ,
    app: require('express')().use('/', function(req, res) {
        res.end('Hello, World!');
    })

}).listen(80, 443);
