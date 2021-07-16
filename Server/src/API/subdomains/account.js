const express = require('express');
const Account_Router = express.Router();

const validator = require('validator');

const Nord = require('../../Middleware/Nord.js');
const Account = require('../../Account/account.js');
const Logger = require('../../Middleware/Logger.js')


const bodyParser = require('body-parser');

Account_Router.use(bodyParser.urlencoded({extended: true}));
Account_Router.use(bodyParser.json({limit: '50mb'}))

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Account_Router.post('/login', async(req, res) => {
  if ( validator.isEmail(req.body.email) && req.body.password ) {
    Logger.CustomActivityLog({"action": 'Login Attempt'})
    await Account.Login(req.body.email, req.body.password, req, res);
  } else {
    return res.send({ "Acc_Server": "Incorrect_Cred" })
  }
})

Account_Router.post('/signup', async(req, res) => {
  if (validator.isEmail(req.body.email) && req.body.password) {
    console.log('Valid Email+Pass');
    return;
    Logger.CustomActivityLog({"action": 'Account Creation'})
    await Account.Create(req.body.email, req.body.password, req, res);
  } else {
    return res.send({ "Acc_Server": "Invalid_Email" })
  }
})

// =================

Account_Router.use('/login', function(req, res, next) { res.sendFile('F:\\Nanode\\Nanode Client\\views\\login.html'); });
Account_Router.get('/', Nord.Middle, async (req, res) => { console.log('AccountPageViewed');  res.sendFile('F://Nanode/Nanode Client/views/account.html', {extensions: ['html', 'htm']}) });


module.exports = Account_Router;