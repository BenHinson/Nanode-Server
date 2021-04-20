var express = require('express');
var Spiral_Router = express.Router();
const csp = require(`helmet-csp`)
const corsOptions = {origin: 'https://spiral.Nanode.one'}
const Helper = require('../helper.js');

Spiral_Router.get('/', function(req, res) {
  Helper.ActivityLog(req)
  res.sendFile('F:\\Nanode\\Nanode Client\\views\\spiral.html');
});

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Spiral_Router.use(express.urlencoded({extended: false}))
Spiral_Router.use(csp({
  directives: {
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));

module.exports = Spiral_Router;