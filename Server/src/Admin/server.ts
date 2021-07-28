// Module Calls
import express from 'express';
import fs from 'fs';
import * as Mongo from './mongo'

import bodyParser from 'body-parser';
import helmet from 'helmet';
import csp from 'helmet-csp';
import cors from 'cors';

import featurePolicy from 'feature-policy';
import cookie from 'cookie';
import cookieParser from 'cookie-parser';
import subdomain from 'express-subdomain';

const app = express();
const router = express.Router({mergeParams: true});

const CACHE_TIME = 86400000; // 86400000 (24 hours)

const Start_Server = function() {
  const options = {
    key: fs.readFileSync('F:\\Nanode/Nanode Server/auth/nanode.one.key'),
    cert: fs.readFileSync('F:\\Nanode/Nanode Server/auth/nanode.one.crt'),
    ca: fs.readFileSync('F:\\Nanode/Nanode Server/auth/origin_ca_rsa_root.pem'),
  }

  const corsOptions = {
    credentials: true,
    origin: true,
  }

  // Start Server
  const server = require('https').createServer(options, app);

  // Setup Server
  app.set('view-engine', 'ejs');
  app.use(helmet());
  app.use(helmet.referrerPolicy({ policy: 'same-origin' }));
  app.use(cookieParser(SECRET_KEY));
  app.use(cors(corsOptions))
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json({limit: '50mb'}))
  app.use(featurePolicy({features: {camera: ["'none'"], geolocation: ["'none'"]}}))
  app.use(csp({
    directives: {
      connectSrc: ["'self'", '*.nanode.one', 'nanode.one', 'https://nanode.one/socket.io/','wss://nanode.one/socket.io/'],
      styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
    }
  }));
  // app.use((err:any, req:Request, res:Response) => {
  //   res.status(err.status || 500);
  //   res.json();
  // })
  
  // Server Listen
  server.listen(443, () => { console.log('Running on Port', server.address().port) });

  // Subdomains
  app.use(subdomain('drive', require('../API/subdomains/drive')))
  app.use(subdomain('account', require('../API/subdomains/account')))
  app.use(subdomain('dev', require('../API/subdomains/dev')))
  app.use(subdomain('link', require('../API/subdomains/link')))
  app.use(subdomain('spiral', require('../API/subdomains/spiral')))
  app.use(subdomain('speech', require('../API/subdomains/speech')))
  app.use(express.static('F:\\Nanode/Nanode Client', {maxAge: CACHE_TIME}));

  // ========== Account Login Check ==========
  app.get('/check', require('../Middleware/Nord.js').Middle, (req, res) => {
    return res.send({"loggedIn": req.headers.uID ? true : false})
  })
  // ========= Work-In-Progress Page =========
  // app.get('/new', function(req, res) { return res.status(200).sendFile('F:\\Nanode\\Nanode Client\\views\\new\\new.html'); })
  // ========== Error page Fallback ==========
  app.use((req, res) => { return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html') })

}

import {SECRET_KEY} from './keys.js'

/////////////////////////////////////  Ctrl+Shift+C  ///////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

Mongo.connectToServer((err:Error, client:any) => {
  if (err) {console.log(`ERROR: ${err}`)}
  console.log("Successful MongoDB Connection.");
  
  Start_Server();
  
  const Helper = require('../helper.js');
  const Nord = require('../Middleware/Nord.js');
  const Node = require('../Node/node.js');
  const Account = require('../Account/account.js');
  const Send = require('../API/send.js');
})