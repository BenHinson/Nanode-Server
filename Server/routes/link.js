var fs = require('fs-extra');
var express = require('express');
var Link_Router = express.Router();

const csp = require(`helmet-csp`)
var cors = require('cors');
const corsOptions = {origin: 'https://link.Nanode.one'}

const crypto = require('crypto');
const sharp = require('sharp');

const Helper = require('../helper.js');
const Nord = require('../Nord.js');

const GetSet = require('../GetSet.js');


// npm install ejs.
// app.set('view-engine', 'ejs');
// change example.html to example.ejs
// inside example.ejs change '<p>File Name</p>' to '<p><%= file_name %></p>'  <%=  %>
// res.render('example.ejs', {file_name: VALUE}). VALUE = 'string' or variable.

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

Link_Router.use((req, res, next) => {res.locals.nonce = crypto.randomBytes(16).toString('hex');next();});
Link_Router.use(express.urlencoded({extended: false}))
Link_Router.use(csp({
  directives: {
    connectSrc: ["'self'", 'https://Nanode.one/socket.io/','wss://Nanode.one/socket.io/'],
    styleSrc: ["'self'", 'use.fontawesome.com', 'fonts.googleapis.com', 'nanode.one', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com', 'use.fontawesome.com'],
  }
}));

Link_Router.use('/download/preview/:id', cors(corsOptions), async(req, res) => {
  let item = parseInt(req.query.item);
  if (typeof item != 'undefined' && Number.isInteger(item)) {
    await GetSet.readDownloadLink(req.params.id).then(function(result) {
      if (result.for == "SHARE") {
        fs.readFile('F:\\Nanode\\UsersContent\\'+result.preview[item].File, function(err, data) {
          if (err) { return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); } else {
            res.setHeader("Content-Type", result.preview[item].Mime);
            res.writeHead(200);
            res.end(data);
          }
        })
      }
    })
  }
  // return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');
})

Link_Router.use('/download/a/:id', async(req, res) => {
  await GetSet.readDownloadLink(req.params.id).then(function(result) {
    if (result.for == "SELF") { return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); }
    else if (result.for == "SHARE") {
      return res.download("F:\\Nanode\\UserDownloads\\Nanode_"+result.url+".zip", function(err) {
        if (err) {return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');}
      })
    }
  }).catch((err) => { console.log(err); return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); })
})

Link_Router.use('/download/:id', cors(corsOptions), async(req, res) => {
  let Account = await Nord.Check("HTTP", req, res);
  let userID = Account.uID;
  await GetSet.readDownloadLink(req.params.id).then(function(result) {
    if (result === false || (result.for == "SELF" && userID != result.owner)) { return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); }
    if (result.for == "SELF" && userID == result.owner) {
      res.download("F:\\Nanode\\UserDownloads\\Nanode_"+result.url+".zip", function(err) {
        if (err) {res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');}
      })
    } else {
      res.render('F:\\Nanode\\Nanode Client\\views\\download.ejs', {
        ejs_url: "https://link.nanode.one/download/a/"+result.url,
        ejs_item: result.url,
        ejs_title: result.title+".zip",
        ejs_name: result.title,
        ejs_size: Helper.convertSize(result.size),
        ejs_items: result.contents.length + (result.contents.length > 1 ? " items" : " item"),
        ejs_contents: result.contents,
        ejs_preview: result.preview,
        ejs_preview_count: result.preview ? result.preview.length : 0,
        ejs_scanned: result.scanned
      })
    }
  }).catch((err) => { console.log(err); return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); })
})

Link_Router.use('/:link', cors(corsOptions), async(req, res) => {
  let fileName_mimeType = await GetSet.readShareLink(req.params.link).then(function(result) {
    if (result === false) { return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');; }
    if (result.mime != "FOLDER") {
      fs.readFile('F:\\Nanode\\UsersContent\\'+result.file, function(err, data) {
        if (err) {return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); } else {
          res.setHeader("Content-Type", result.mime);
          res.writeHead(200);
          res.end(data);
        }
      });
    }
    if (result.mime == "FOLDER") {
      console.log(result)
      console.log("Folder Support Soon");
      return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html');;
    }
  }).catch((err) => { console.log(err); return res.status(404).sendFile('F:\\Nanode\\Nanode Client\\views\\Error.html'); })
})

Link_Router.get('/', async (req, res) => { res.redirect('https://Nanode.one'); })

module.exports = Link_Router;