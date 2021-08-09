
import {getColl} from '../Admin/mongo';
const Link_Coll = getColl('link');
const Download_Coll = getColl('download');

import Account from './account';
import Node from '../Node/node';

// =================================================== 

const writeShareLink = async(linkID:NodeID, userID:User, linkData:LinkData) => {
  const {oID, file_name, mime} = linkData;
  return Link_Coll.insertOne({url: linkID, owner: userID, object: oID, file: file_name, mime: mime})
  .then(() => {
    Account.Write({
      "user": userID,
      "type": "Set",
      "parentKey":"share_links",
      "childKey":linkID,
      "data": {"file": file_name}
    });
    return linkID;
  })
  .catch((err:Error) => {console.error(`Couldn't write Link ${err}`); return false; })
}
const readShareLink = async(linkID:NodeID) => {
  return Link_Coll.find({url: linkID}, {$exists: true})
    .toArray()
    .then((items:any) => { return items.length ? items[0] : false })
    .catch((err:Error) => { return false; })
}
export const removeShareLink = async(user:User, links:string[], removeFromNode:boolean=false) => { // key: NodeID, value: url
  if (!links.length) { return }

  if (removeFromNode) {
    // The link is removed from the node when sent to bin as its more efficient. Hence this option
    console.log('REMOVE LINK FROM THE NODE');
  }

  Account.Write({user, type:'Unset', multi:true, parentKey:'share_links', 'childKey':links});

  return Link_Coll.deleteMany({
    url: {$in: links}
  })
}


const writeDownloadLink = async(linkID:string, For:'SELF'|'SHARE', userID:string, data:ZipData) => {
  const Contents = data.contents.map((item:any) => ({"Name": item.Name, "Mime": item.Mime}))
  return Download_Coll.insertOne({"url": linkID, "for": For.match(/SELF|SHARE/) ? For : "SELF", "owner": userID, "title": data.title, "size": data.size, "contents": Contents})
    .then(() => {
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
    .catch((err:Error) => {console.error(`Couldn't write Link ${err}`); return false; })
}
const readDownloadLink = async (linkID:string) => {
  return Download_Coll.find({url: linkID}, {$exists: true})
    .toArray()
    .then((items:any[]) => { return items.length ? items[0] : false })
    .catch((err:Error) => { return false; })
}


const incrementDownloadCount = async(url:string) => {
  return Download_Coll.updateOne( 
    {"url": url}, 
    { $inc: { "count": 1 } }
  )
}


export default { writeShareLink, readShareLink, writeDownloadLink, readDownloadLink, incrementDownloadCount }