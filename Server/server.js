// Module Calls
const fs = require('fs-extra');
const path = require('path');

const bodyParser = require('body-parser');
const helmet = require('helmet')
const csp = require(`helmet-csp`)
const cors = require('cors');
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
  // app.use(helmet.featurePolicy({features: {camera: ["'none'"]}}))
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
  app.use(subdomain('drive', require('./routes/drive')))
  app.use(subdomain('account', require('./routes/account')))
  app.use(subdomain('dev', require('./routes/dev')))
  app.use(subdomain('link', require('./routes/link')))
  app.use(subdomain('spiral', require('./routes/spiral')))
  app.use(subdomain('speech', require('./routes/speech')))
  app.use(express.static('../Nanode Client'));

  // ========== Account Login Check ==========
  app.get('/check', require('./Nord.js').Middle, async(req, res) => { return res.send({"loggedIn": req.headers.uID ? true : false}) })
  // ========== Error page Fallback ==========
  app.use(function (req, res, next) { return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); })

}

const Keys = require('./Keys.js')
const Mongo_Connect = require('./Mongo_Connect');

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

Mongo_Connect.connectToServer(function(err, client) {
  if (err) {console.log(`ERROR: ${err}`)}
  console.log("Successful MongoDB Connection.");
  
  Start_Server();
  
  const Helper = require('./Helper.js');
  const Nord = require('./Nord.js');
  const Nano = require('./Nano.js');
  const GetSet = require('./GetSet.js');
  const Send = require('./Send.js');
})