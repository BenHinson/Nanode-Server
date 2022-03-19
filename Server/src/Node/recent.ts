// ------ Recent Controller ------ 06/06/2021

import Node from './node';

// =====================================================================


const Push = async(DATA:{userId:UserId, section:Sections, nodeId:string|string[]}) => {
  let {userId, section, nodeId} = DATA;
  if (!Array.isArray(nodeId)) { nodeId = [nodeId] }

  let currentRecentNodes = await Node.Custom_Read({userId, "query": {[`recent.${section}`]: 1}});
  if (!currentRecentNodes['recent'][section]) { return false; }
  
  nodeId.filter(e => !currentRecentNodes['recent'][section].includes(e));  // Prevents duplicates. Trash MongoDB doesn't do this natively. $addToSet has to limit/$slice function.

  if (nodeId.length) {
    Node.Custom_Update({userId, "action": '$push', "key": `recent.${section}`, "CUSTOM": {$each: nodeId, $slice: -8}})
  }

  // Currently Works with: /storage/:content API  AND  /edit API.
  // Upload / Write has its own built in Pusher for FILES ONLY.
  // Deleted files are removed from recent if they are there. May need some more testing
}

const Fetch = async(DATA:{userId:UserId, section:Sections}) => { // https://drive.nanode.one/activity/recent/main
  const {userId, section} = DATA;

  let recentIds = await Node.Custom_Read({ userId, "query": {[`recent.${section}`]: 1}});
  let recentNodes = await Node.Read({
    userId, 
    "type": "SPECIFIC", 
    "section": section, 
    "nodeIds": recentIds['recent'][section], 
    "keys": ['name', 'size', 'type', 'parent']
  })
  return {'recent': recentNodes};
}

export default { Push, Fetch }