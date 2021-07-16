// ------ Recent Controller ------ 06/06/2021

const Mongo = require('../Admin/mongo');
const Node_Coll = Mongo.getColl("node");

const Node = require('./node.js');

// =====================================================================

module.exports = {
  Push: async(DATA) => {
    let {user, section, id} = DATA;
    if (!Array.isArray(id)) { id = [id] }

    let currentRecentNodes = await Node.Read({user, "CUSTOM": {[`recent.${section}`]: 1}});
    currentRecentNodes = currentRecentNodes['recent'][section];
    if (!currentRecentNodes) { return false; }
    id.filter(e => !currentRecentNodes.includes(e));  // Prevents duplicates. Trash MongoDB doesnt do this natively. $addToSet has to limit/$slice function.

    if (id.length) { Node.Custom_Update({"user": user, "ACTION": '$push', "KEY": `recent.${section}`, "CUSTOM": {$each: id, $slice: -8}}) }

    // Currently Works with: /storage/:content API  AND  /edit API.
    // Upload / Write has its own built in Pusher for FILES ONLY.
    // Deleted files are removed from recent if they are there. May need some more testing
  },
  Fetch: async(DATA) => { // https://drive.nanode.one/activity/recent/main
    const {userID, section} = DATA;

    let recentIDs = await Node.Read({"user": userID, "CUSTOM": {[`recent.${section}`]: 1}});
    let recentNodes = await Node.Read({"user": userID, "type": "SPECIFIC", "section": section, "ids": recentIDs['recent'][section], "keys": ['name', 'size', 'type', 'parent']})
    return {'recent': recentNodes};
  }
}
