var express = require('express');
var Account_Router = express.Router();

const csp = require(`helmet-csp`)
const corsOptions = {origin: 'https://account.Nanode.one'}

const crypto = require('crypto');
const validator = require('validator');

const { nanoid } = require('nanoid');
const cookie_sign = require('cookie-signature');

const Nord = require('../Nord.js');
const GetSet = require('../GetSet.js');

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Account_Router.use((req, res, next) => {res.locals.nonce = crypto.randomBytes(16).toString('hex');next();});
Account_Router.use(express.urlencoded({extended: false}))
Account_Router.use(csp({
  directives: {
    connectSrc: ["'self'", 'https://Nanode.one/socket.io/','wss://Nanode.one/socket.io/'],
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', 'nanode.one', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));


Account_Router.use('/login', function(req, res, next) { res.sendFile('F:\\Nanode\\Nanode Client\\views\\login.html'); })
Account_Router.get('/', Nord.Middle, async (req, res) => { res.sendFile('F://Nanode/Nanode Client/views/account.html', {extensions: ['html', 'htm']}) });


app.post('/login', async (req, res) => {
  if ( validator.isEmail(req.body.email) && req.body.password ) {
    await GetSet.Account_Login(req.body.email, req.body.password, req, res);
  } else {
    return res.send({ "Acc_Server": "Incorrect_Cred" })
  }
})

app.post('/signup', async (req, res) => {
  if (validator.isEmail(req.body.email) && req.body.password) {
    await GetSet.Account_Create(req.body.email, req.body.password, req, res);
  } else {
    return res.send({ "Acc_Server": "Invalid_Email" })
  }
})

module.exports = Account_Router;