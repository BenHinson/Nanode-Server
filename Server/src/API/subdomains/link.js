const fs = require('fs-extra');
const express = require('express');
const Link_Router = express.Router();

const csp = require(`helmet-csp`)
const cors = require('cors');
const corsOptions = {origin: 'https://link.Nanode.one'}

const crypto = require('crypto');
const sharp = require('sharp');

const Helper = require('../../helper.js');
const ReadWrite = require('../../Nano/ReadWrite.js');
const Nord = require('../../Middleware/Nord.js');
const Links = require('../../Account/links.js')



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
    await Links.readDownloadLink(req.params.id).then(function(result) {
      if (result.for == "SHARE") {
        ReadWrite.Mass(res, result.preview[item].File, result.preview[item].Mime);
      }
    })
    return;
  }
  return Helper.ErrorPage(res);
})

Link_Router.use('/download/a/:id', async(req, res) => {
  await Links.readDownloadLink(req.params.id).then(function(result) {
    if (result.for == "SELF") { return Helper.ErrorPage(res); }
    else if (result.for == "SHARE") {
      return res.download("F:\\Nanode\\Files\\Downloads\\Nanode_"+result.url+".zip", result.title+".zip", function(err) {
        if (err) {return Helper.ErrorPage(res);}
        Links.incrementDownloadCount(result.url);
      })
    }
  }).catch((err) => { console.log(err); return Helper.ErrorPage(res); })
})

Link_Router.use('/download/:id', cors(corsOptions), async(req, res) => {
  let Account = await Nord.ValidateCookie(req, res);
  let userID = Account.uID;
  await Links.readDownloadLink(req.params.id).then(function(result) {
    if (result === false || (result.for == "SELF" && userID != result.owner)) { return Helper.ErrorPage(res); }
    if (result.for == "SELF" && userID == result.owner) {
      res.download("F:\\Nanode\\Files\\Downloads\\Nanode_"+result.url+".zip", result.title+".zip", function(err) {
        if (err) {return Helper.ErrorPage(res);}
      })
    } else {
      res.render('F:\\Nanode\\Nanode Client\\views\\download.ejs', {
        ejs_url: "https://link.nanode.one/download/a/"+result.url,
        ejs_item: result.url,
        ejs_title: result.title+".zip",
        ejs_name: result.title,
        ejs_size: Helper.convertSize(result.size),
        ejs_items: result.contents.length + (result.contents.length > 1 ? " items" : " item"),
        ejs_count: result.count || 0,
        ejs_contents: result.contents,
        ejs_preview: result.preview,
        ejs_preview_count: result.preview ? result.preview.length : 0,
        ejs_scanned: result.scanned
      })
    }
  }).catch((err) => { console.log(err); return Helper.ErrorPage(res); })
})

Link_Router.use('/:link', cors(corsOptions), async(req, res) => {
  let fileName_mimeType = await Links.readShareLink(req.params.link).then(function(result) {
    if (result === false) { return Helper.ErrorPage(res); }
    if (result.mime != "FOLDER") { ReadWrite.Mass(res, result.file, result.mime); }
    if (result.mime == "FOLDER") {
      console.log(result)
      console.log("Folder Support Soon");
      return Helper.ErrorPage(res);
    }
  }).catch((err) => { console.log(err); return Helper.ErrorPage(res); })
})

Link_Router.get('/', async (req, res) => { res.redirect('https://Nanode.one'); })

module.exports = Link_Router;