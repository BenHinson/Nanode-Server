// Module Calls
import 'dotenv/config';

import express from 'express';
import fs from 'fs';
import * as Mongo from './mongo';

import helmet from 'helmet';
import csp from 'helmet-csp';
import cors from 'cors';

import featurePolicy from 'feature-policy';
import cookie from 'cookie';
import cookieParser from 'cookie-parser';
import subdomain from 'express-subdomain';
import request from 'request';
import httpProxy from 'http-proxy';

import Logger from '../Middleware/Logger.js';

// =========================

const app = express();

const Start_Server = (Nauth: LooseObject) => {
  const options = {
    key: fs.readFileSync('F:\\Nanode/Nanode Server/auth/nanode.one.key'),
    cert: fs.readFileSync('F:\\Nanode/Nanode Server/auth/nanode.one.crt'),
    ca: fs.readFileSync('F:\\Nanode/Nanode Server/auth/origin_ca_rsa_root.pem'),
  };

  const corsOptions = {
    credentials: true,
    origin: true,
  };

  // Start Server
  const server = require('https').createServer(options, app);
  
  const proxy = httpProxy.createProxyServer();

  // Placing this here, bypasses bodyParser and is able to proxy the request.
  app.use(subdomain('playground', function (req: any, res: any, next: any) {
    proxy.web(req, res, {
      target: {
        host: process.env.PROXY_HOST_PLAYGROUND,
        port: process.env.PROXY_PORT_PLAYGROUND,
      },
    }, (err: Error) => {});
  }));

  // Setup Server
  app.set('view-engine', 'ejs');
  app.use(helmet());
  app.use(helmet.referrerPolicy({policy: 'same-origin'}));
  app.use(cookieParser(process.env.SECRET_KEY!));
  app.use(cors(corsOptions));
  app.use(express.urlencoded({extended: true}));
  app.use(express.json({limit: process.env.DATA_CAP}));
  app.use(
    featurePolicy({features: {camera: ["'none'"], geolocation: ["'none'"]}}),
  );
  app.use(
    csp({
      directives: {
        connectSrc: ["'self'", '*.nanode.one', 'nanode.one'],
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

  // Server Listen
  server.listen(process.env.PORT!, () => {
    console.log('Running on Port', server.address().port);
  });

  // Subdomains
  app.use(subdomain('drive', require('../API/subdomains/drive')));
  app.use(subdomain('upload', require('../API/subdomains/upload')));
  app.use(subdomain('account', require('../API/subdomains/account')));
  app.use(subdomain('dev', require('../API/subdomains/dev')));
  app.use(subdomain('link', require('../API/subdomains/link')));
  app.use(subdomain('spiral', require('../API/subdomains/spiral')));
  app.use(subdomain('speech', require('../API/subdomains/speech')));

  app.use(express.static('F:\\Nanode/Nanode Client', {maxAge: 86_400_000})); // (24 hours)

  // ========== Account Login Check ==========
  app.get('/check', Nauth.default.Middle, (req, res) => {
    return res.send({
      loggedIn: req.headers.userId ? true : false,
      accountDetails: req.query?.details ? req.headers.accountDetails : null,
    });
  });
  // ========= Data_Flow Page =========
  app.get('/data-flow', function (req, res) {
    Logger.CustomActivityLog({page: 'Data Flow'});
    return res
      .status(200)
      .sendFile('F:\\Nanode\\Nanode Client\\views\\misc\\data-flow.html');
  });
  // ========== Error page Fallback ==========
  app.use((req, res) => {
    return res
      .status(404)
      .sendFile('F:\\Nanode\\Nanode Client\\views\\misc\\Error.html');
  });
};

/////////////////////////////////////  Ctrl+Shift+C  ///////////////////////////////////////////////

Mongo.connectToServer((err: Error, client: any) => {
  if (err) console.log(`ERROR: ${err}`);

  console.log('Successful MongoDB Connection.');

  const Nauth = require('../Middleware/Nauth.js');

  Start_Server(Nauth);

  const Helper = require('../helper.js');
  const Node = require('../Node/node.js');
  const Account = require('../Account/account.js');
  const Send = require('../API/send.js');
});