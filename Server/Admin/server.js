// Module Calls
const fs = require('fs-extra');
const path = require('path');

const bodyParser = require('body-parser');
const helmet = require('helmet')
const csp = require(`helmet-csp`)
const cors = require('cors');
const featurePolicy = require("feature-policy");
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const subdomain = require('express-subdomain');
express = require('express');
app = express();
router = express.Router({mergeParams: true});

const ejs = require('ejs');

Start_Server = function() {
  const options = {
    key: fs.readFileSync('Server/auth/nanode.one.key'),
    cert: fs.readFileSync('Server/auth/nanode.one.crt'),
    ca: fs.readFileSync('Server/auth/origin_ca_rsa_root.pem'),
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
  app.use(cookieParser(Keys.SECRET_KEY));
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
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({ message: err.message, error: err });
  })
  
  // Server Listen
  server.listen(443, () => { console.log('Running on Port', server.address().port) });

  // Subdomains
  app.use(subdomain('drive', require('../API/subdomains/drive')))
  app.use(subdomain('account', require('../API/subdomains/account')))
  app.use(subdomain('dev', require('../API/subdomains/dev')))
  app.use(subdomain('link', require('../API/subdomains/link')))
  app.use(subdomain('spiral', require('../API/subdomains/spiral')))
  app.use(subdomain('speech', require('../API/subdomains/speech')))
  app.use(express.static('../Nanode Client'));

  // ========== Account Login Check ==========
  app.get('/check', require('../Middleware/Nord.js').Middle, async(req, res) => { return res.send({"loggedIn": req.headers.uID ? true : false}) })
  // ========= Work-In-Progress Page =========
  // app.get('/new', function(req, res) { return res.status(200).sendFile('F:\\Nanode\\Nanode Client\\views\\new\\new.html'); })
  // ========== Error page Fallback ==========
  app.use(function (req, res, next) { return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); })

}

const Keys = require('./keys.js')
const Mongo = require('./mongo');

/////////////////////////////////////  Ctrl+Shift+C  ///////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

Mongo.connectToServer(function(err, client) {
  if (err) {console.log(`ERROR: ${err}`)}
  console.log("Successful MongoDB Connection.");
  
  Start_Server();
  
  const Helper = require('../helper.js');
  const Nord = require('../Middleware/Nord.js');
  const Node = require('../Node/node.js');
  const Account = require('../Account/account.js');
  const Send = require('../API/send.js');
})