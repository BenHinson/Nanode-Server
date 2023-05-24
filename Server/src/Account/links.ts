import {getColl} from '../Admin/mongo';
const Link_Coll = getColl('link');
const Download_Coll = getColl('download');

import Account from './account';
import Node from '../Node/node';

// ===================================================

const writeShareLink = async (
  linkId: NodeId,
  userId: UserId,
  linkData: LinkData,
) => {
  const {nodeId, fileName, mime} = linkData;
  return Link_Coll.insertOne({
    url: linkId,
    owner: userId,
    object: nodeId,
    file: fileName,
    mime: mime,
  })
    .then(() => {
      Account.Write({
        userId,
        type: 'SET',
        parentKey: 'shareLinks',
        childKey: linkId,
        data: {file: fileName},
      });
      return linkId;
    })
    .catch((err: Error) => {
      console.error(`Couldn't write Link ${err}`);
      return false;
    });
};
const readShareLink = async (linkId: NodeId) => {
  return Link_Coll.find({url: linkId}, {$exists: true})
    .toArray()
    .then((items: any) => {
      return items.length ? items[0] : false;
    })
    .catch((err: Error) => {
      return false;
    });
};
export const removeShareLink = async (
  userId: UserId,
  links: string[],
  removeFromNode: boolean = false,
) => {
  // key: NodeID, value: url
  if (!links.length) {
    return;
  }

  if (removeFromNode) {
    // The link is removed from the node when sent to bin as its more efficient. Hence this option
    console.log('REMOVE LINK FROM THE NODE');
  }

  Account.Write({
    userId,
    type: 'UNSET',
    multi: true,
    parentKey: 'shareLinks',
    childKey: links,
  });

  return Link_Coll.deleteMany({
    url: {$in: links},
  });
};

const writeDownloadLink = async (
  linkId: string,
  forUser: 'SELF' | 'SHARE',
  userId: UserId,
  data: ZipData,
) => {
  const contents = data.contents.map((item: any) => ({
    name: item.name,
    mime: item.mime,
  }));
  return Download_Coll.insertOne({
    url: linkId,
    forUser: forUser.match(/SELF|SHARE/) ? forUser : 'SELF',
    owner: userId,
    title: data.title,
    size: data.size,
    contents,
  })
    .then(() => {
      if (forUser == 'SHARE') {
        Account.Write({
          userId,
          type: 'SET',
          parentKey: 'downloadLinks',
          childKey: linkId,
          data: {title: data.title, size: data.size, items: contents.length},
        });
      }
      return linkId;
    })
    .catch((err: Error) => {
      console.error(`Couldn't write Link ${err}`);
      return false;
    });
};
const readDownloadLink = async (linkId: string) => {
  return Download_Coll.find({url: linkId}, {$exists: true})
    .toArray()
    .then((items: any[]) => {
      return items.length ? items[0] : false;
    })
    .catch((err: Error) => {
      return false;
    });
};

const incrementDownloadCount = async (url: string) => {
  return Download_Coll.updateOne({url: url}, {$inc: {count: 1}});
};

export default {
  writeShareLink,
  readShareLink,
  writeDownloadLink,
  readDownloadLink,
  incrementDownloadCount,
};
