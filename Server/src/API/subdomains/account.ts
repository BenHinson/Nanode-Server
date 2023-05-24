import express from 'express';
const Account_Router = express.Router();

import csp from 'helmet-csp';
import cors from 'cors';
const corsOptions = {origin: 'https://drive.nanode.one'};

import validator from 'validator';

import Nauth from '../../Middleware/Nauth';
import Account from '../../Account/account';
import Logger from '../../Middleware/Logger';

Account_Router.use(express.urlencoded({extended: true}));
Account_Router.use(express.json());
Account_Router.use(cors(corsOptions));
Account_Router.use(
  csp({
    directives: {
      connectSrc: ["'self'", 'nanode.one'],
      styleSrc: [
        "'self'",
        'use.fontawesome.com',
        'fonts.googleapis.com',
        'nanode.one',
        "'unsafe-inline'",
      ],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
    },
  }),
);

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Account_Router.post('/login', async (req, res) => {
  if (validator.isEmail(req.body.email) && req.body.password) {
    Logger.CustomActivityLog({action: 'Login Attempt'});
    await Account.Login(req.body.email, req.body.password, req, res);
  } else {
    return res.send({Acc_Server: 'Incorrect_Cred'});
  }
});

Account_Router.post('/signup', async (req, res) => {
  if (validator.isEmail(req.body.email) && req.body.password) {
    Logger.CustomActivityLog({action: 'Account Creation'});
    await Account.Create(req.body.email, req.body.password, req, res);
  } else {
    return res.send({Acc_Server: 'Invalid_Email'});
  }
});

// =================

Account_Router.use('/login', function (req, res, next) {
  res.sendFile('F:\\Nanode\\Nanode Client\\views\\account\\login.html');
});
Account_Router.get('/', Nauth.Middle, async (req, res) => {
  console.log('AccountPageViewed');
  res.sendFile('F://Nanode/Nanode Client/views/account/account.html', {
    extensions: ['html', 'htm'],
  });
});

module.exports = Account_Router;
