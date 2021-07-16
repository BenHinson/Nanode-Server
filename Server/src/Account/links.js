const Mongo_Connect = require('../Admin/mongo');

const Link_Coll = Mongo_Connect.getColl('link');
const Download_Coll = Mongo_Connect.getColl('download');

const Account = require('./account.js')

// =================================================== 

module.exports = {
  writeShareLink: async(linkID, userID, linkData) => {
    const {oID, file_name, mime} = linkData;
    return Link_Coll.insertOne({url: linkID, owner: userID, object: oID, file: file_name, mime: mime})
    .then(result => {
      Account.Write({
        "user": userID,
        "type": "Set",
        "parentKey":"share_links",
        "childKey":linkID,
        "data": {"file": file_name}
      });
      return linkID;
    })
    .catch(err => {console.error(`Couldn't write Link ${err}`); return false; })
  },
  readShareLink: async (linkID) => {
    return Link_Coll.find({url: linkID}, {$exists: true})
      .toArray()
      .then(items => { return items.length ? items[0] : false })
      .catch((err) => { return false; })
  },

  
  writeDownloadLink: async(linkID, For, userID, data) => {
    Contents = data.contents.map(item => ({"Name": item.Name, "Mime": item.Mime}))
    return Download_Coll.insertOne({"url": linkID, "for": For.match(/SELF|SHARE/) ? For : "SELF", "owner": userID, "title": data.title, "size": data.size, "contents": Contents})
      .then(result => {
        if (For == "SHARE") {
          Account.Write({ 
            "user": userID, 
            "type":"Set", 
            "parentKey": "download_links", 
            "childKey": linkID, 
            "data": {"title": data.title, "size": data.size, "items": Contents.length} });
          }
        return linkID;
      })
      .catch(err => {console.error(`Couldn't write Link ${err}`); return false; })
  },
  readDownloadLink: async (linkID) => {
    return Download_Coll.find({url: linkID}, {$exists: true})
      .toArray()
      .then(items => { return items.length ? items[0] : false })
      .catch((err) => { return false; })
  },
  

  incrementDownloadCount: async(url) => {
    return Download_Coll.updateOne( 
      {"url": url}, 
      { $inc: { "count": 1 } }
    )
  },
}