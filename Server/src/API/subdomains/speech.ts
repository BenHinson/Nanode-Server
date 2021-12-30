import express from 'express';
const Speech_Router = express.Router();

import csp from 'helmet-csp';
const corsOptions = {origin: 'https://speech.Nanode.one'}

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Speech_Router.get('/', function(req, res) { res.sendFile('F:\\Nanode\\Nanode Client\\views\\misc\\speech.html') });


Speech_Router.use(express.urlencoded({extended: false}))
Speech_Router.use(csp({
  directives: {
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));

module.exports = Speech_Router;