var express = require('express');
var Account_Router = express.Router();

const validator = require('validator');

const Nord = require('../Nord.js');
const GetSet = require('../GetSet.js');
const Helper = require('../Helper.js');

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Account_Router.use('/login', function(req, res, next) { res.sendFile('F:\\Nanode\\Nanode Client\\views\\login.html'); })
Account_Router.get('/', Nord.Middle, async (req, res) => { console.log('AccountPageViewed');  res.sendFile('F://Nanode/Nanode Client/views/account.html', {extensions: ['html', 'htm']}) });

app.post('/login', async (req, res) => {
  if ( validator.isEmail(req.body.email) && req.body.password ) {
    Helper.CustomActivityLog({"action": 'Login Attempt'})
    await GetSet.Account_Login(req.body.email, req.body.password, req, res);
  } else {
    return res.send({ "Acc_Server": "Incorrect_Cred" })
  }
})

app.post('/signup', async (req, res) => {
  if (validator.isEmail(req.body.email) && req.body.password) {
    Helper.CustomActivityLog({"action": 'Account Creation'})
    await GetSet.Account_Create(req.body.email, req.body.password, req, res);
  } else {
    return res.send({ "Acc_Server": "Invalid_Email" })
  }
})

module.exports = Account_Router;