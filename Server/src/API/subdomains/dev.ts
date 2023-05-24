import express from 'express';
const Dev_Router = express.Router();

import csp from 'helmet-csp';
import crypto from 'crypto';
const corsOptions = {origin: 'https://dev.nanode.one'};

import Logger from '../../Middleware/Logger';

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Dev_Router.use(express.urlencoded({extended: false}));
Dev_Router.use(
  csp({
    directives: {
      connectSrc: [
        "'self'",
        'https://nanode.one/socket.io/',
        'wss://nanode.one/socket.io/',
      ],
      styleSrc: [
        "'self'",
        'use.fontawesome.com',
        'fonts.googleapis.com',
        "'unsafe-inline'",
      ],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
    },
  }),
);

Dev_Router.get('/:page?', function (req, res) {
  let page = req.params.page;
  Logger.ActivityLog(req, {page: page || ''});
  // if (page == 'design') {
  //   res.sendFile('F:\\Nanode\\Nanode Client\\views\\design.html')
  // } else {
  res.sendFile('F:\\Nanode\\Nanode Client\\views\\dev.html');
  // }
});

module.exports = Dev_Router;
