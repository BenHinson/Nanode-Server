// ------ Recent Controller ------ 06/06/2021

import Node from './node';

// =====================================================================


const Push = async(DATA:{userID:User, section:Sections, id:string|string[]}) => {
  let {userID, section, id} = DATA;
  if (!Array.isArray(id)) { id = [id] }

  let currentRecentNodes = await Node.Custom_Read({"user": userID, "query": {[`recent.${section}`]: 1}});
  if (!currentRecentNodes['recent'][section]) { return false; }
  
  id.filter(e => !currentRecentNodes['recent'][section].includes(e));  // Prevents duplicates. Trash MongoDB doesn't do this natively. $addToSet has to limit/$slice function.

  if (id.length) {
    Node.Custom_Update({"user": userID, "action": '$push', "key": `recent.${section}`, "CUSTOM": {$each: id, $slice: -8}})
  }

  // Currently Works with: /storage/:content API  AND  /edit API.
  // Upload / Write has its own built in Pusher for FILES ONLY.
  // Deleted files are removed from recent if they are there. May need some more testing
}

const Fetch = async(DATA:{userID:User, section:Sections}) => { // https://drive.nanode.one/activity/recent/main
  const {userID, section} = DATA;

  let recentIDs = await Node.Custom_Read({"user": userID, "query": {[`recent.${section}`]: 1}});
  let recentNodes = await Node.Read({
    "user": userID, 
    "type": "SPECIFIC", 
    "section": section, 
    "ids": recentIDs['recent'][section], 
    "keys": ['name', 'size', 'type', 'parent']
  })
  return {'recent': recentNodes};
}

export default { Push, Fetch }