const express = require('express');
const helmet = require('helmet')
const Speech_Router = express.Router();
const csp = require(`helmet-csp`)
const corsOptions = {origin: 'https://speech.Nanode.one'}

Speech_Router.get('/', function(req, res) { res.sendFile('F:\\Nanode\\Nanode Client\\views\\speech.html') });

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Speech_Router.use(express.urlencoded({extended: false}))
Speech_Router.use(csp({
  directives: {
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));

module.exports = Speech_Router;