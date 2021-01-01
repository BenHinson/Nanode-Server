var express = require('express');
var Dev_Router = express.Router();
const csp = require(`helmet-csp`)
const crypto = require('crypto');
const corsOptions = {origin: 'https://dev.Nanode.one'}

Dev_Router.get('/', function(req, res) { res.sendFile('F:\\Nanode\\Nanode Client\\views\\dev.html') });

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Dev_Router.use((req, res, next) => {res.locals.nonce = crypto.randomBytes(16).toString('hex');next();});
Dev_Router.use(express.urlencoded({extended: false}))
Dev_Router.use(csp({
  directives: {
    connectSrc: ["'self'", 'https://Nanode.one/socket.io/','wss://Nanode.one/socket.io/'],
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));


module.exports = Dev_Router;