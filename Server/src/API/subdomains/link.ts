import fs from 'fs'
import express from 'express'
const Link_Router = express.Router();

import csp from 'helmet-csp'
import cors from 'cors'
const corsOptions = {origin: 'https://link.Nanode.one'}

import crypto from 'crypto'

import {ErrorPage, convertSize} from '../../helper';
import ReadWrite from '../../Nano/ReadWrite';
import * as Nord from '../../Middleware/Nord';
import Links from '../../Account/links';


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

Link_Router.use('/download/preview/:id', cors(corsOptions), async(req, res) => { // @ts-ignore // req.query.item
  let item:number = parseInt(req.query.item) || 0;
  if (typeof item != 'undefined' && Number.isInteger(item)) {
    await Links.readDownloadLink(req.params.id).then((result:DownloadLinkTemplate) => {
      if (result.for == "SHARE") {
        ReadWrite.Mass(res, result.preview[item].File, result.preview[item].Mime);
      }
    })
    return;
  }
  return ErrorPage(res);
})

Link_Router.use('/download/a/:id', async(req, res) => {
  await Links.readDownloadLink(req.params.id).then(function(result:DownloadLinkTemplate) {
    if (result.for == "SELF") { return ErrorPage(res); }
    else if (result.for == "SHARE") {
      return res.download("F:\\Nanode\\Files\\Downloads\\Nanode_"+result.url+".zip", result.title+".zip", function(err) {
        if (err) {return ErrorPage(res);}
        Links.incrementDownloadCount(result.url);
      })
    }
  }).catch((err:Error) => { console.log(`Failed to Download at id: ${req.params.id} with Error: ${err}`); return ErrorPage(res); })
})

Link_Router.use('/download/:id', cors(corsOptions), async(req, res) => {
  let userID = (await Nord.ValidateCookie(req, res)).uID;

  await Links.readDownloadLink(req.params.id).then((result: DownloadLinkTemplate|false) => {
    if (result === false || (result.for == "SELF" && userID != result.owner)) { return ErrorPage(res); }
    if (result.for == "SELF" && userID == result.owner) {
      res.download("F:\\Nanode\\Files\\Downloads\\Nanode_"+result.url+".zip", result.title+".zip", (err) => {
        if (err) {return ErrorPage(res);}
      })
    } else {
      res.render('F:\\Nanode\\Nanode Client\\views\\download.ejs', {
        ejs_url: "https://link.nanode.one/download/a/"+result.url,
        ejs_item: result.url,
        ejs_title: result.title+".zip",
        ejs_name: result.title,
        ejs_size: convertSize(result.size),
        ejs_items: result.contents?.length + (result.contents?.length || 2 > 1 ? " items" : " item"),
        ejs_count: result.count || 0,
        ejs_contents: result.contents,
        ejs_preview: result.preview,
        ejs_preview_count: result.preview ? result.preview.length : 0,
        ejs_scanned: result.scanned
      })
    }
  }).catch((err) => { console.log(err); return ErrorPage(res); })
})

Link_Router.use('/:link', cors(corsOptions), async(req, res) => {
  let fileName_mimeType = await Links.readShareLink(req.params.link).then((result:LinkTemplate|false) => {
    if (result === false) { return ErrorPage(res); }
    else if (result.mime != "FOLDER") { ReadWrite.Mass(res, result.file, result.mime); }
    else if (result.mime == "FOLDER") {
      console.log(result)
      console.log("Folder Support Soon");
      return ErrorPage(res);
    }
  }).catch((err) => { console.log(err); return ErrorPage(res); })
})

Link_Router.get('/', async(req, res) => { res.redirect('https://Nanode.one'); })


module.exports = Link_Router;