import express from 'express'
const Spiral_Router = express.Router();

import csp from 'helmet-csp'
const corsOptions = {origin: 'https://spiral.Nanode.one'}

import Logger from '../../Middleware/Logger'

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////
Spiral_Router.get('/', function(req, res) {
  Logger.ActivityLog(req, {'page': 'Spiral'})
  res.sendFile('F:\\Nanode\\Nanode Client\\views\\spiral.html');
});


Spiral_Router.use(express.urlencoded({extended: false}))
Spiral_Router.use(csp({
  directives: {
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));

module.exports = Spiral_Router;