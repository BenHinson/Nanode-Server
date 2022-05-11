// ------ Storage Engine Rework ------ 15/12/2020 > 02/01/2021
// ------ Node Storage Engine ------
// ------ Typescript Conversion: 29/07/2021 ------

import {getColl} from '../Admin/mongo';
const Node_Coll = getColl('node');

import Nelp from '../tools';
import {Node_Account, Node_Item, Short_Node} from '../templates';

import {removeShareLink} from '../Account/links';
import Account from '../Account/account';

const UploadDrive = process.env.UPLOAD_DRIVE;

import crypto from 'crypto';
import {v1 as uuidv1} from 'uuid';
import uuidv3 from 'uuid/v3';

// =====================  NANO  =====================

const Write = async (
  Set: NodeWrite,
  mongo: MongoObject = {},
): Promise<number | 0> => {
  const {userId, type, section, parent, data} = Set;

  if (parent.match(/home|homepage/i)) {
    // Write to Sections Home
    type == 'Span'
      ? (mongo.$set = {
          [`${section}.${data.id}`]: {name: data.name, contents: {}},
        })
      : (mongo.$set = {[`${section}.${data.id}`]: {...Node_Item, ...data}});
    mongo.$push = {[`home.${section}`]: data.id};
    mongo.$inc = {
      [`size.total.${
        type == 'Span' ? 'SPAN' : Nelp.baseMimeType(data.type.mime)
      }`]: data.size || 1,
    };
  } else if (type.match(/Item|Folder|File/i)) {
    // Write File OR Folder to Section
    mongo.$set = {
      [`${section}.${data.id}`]: {...Node_Item, ...data},
      [`${section}.${data.parent}.contents.${data.id}`]: Short_Contents(data),
    };
    if (type !== 'Folder') {
      mongo.$push = {[`recent.${section}`]: {$each: [data.id], $slice: -8}};
    }
    mongo.$inc = {
      [`size.total.${Nelp.baseMimeType(data.type.mime)}`]: data.size || 1,
    };
  } else {
    return 0;
  }

  // return;
  let written = await Node_Set(userId, mongo);
  return written ? data.size || 1 : 0;
};

const Edit = async (Edit: NodeEdit, mongo: MongoObject = {}) => {
  const {
    userId,
    type,
    section,
    nodeId,
    changeTo = {},
    readCurrent = true,
    subSection,
    bypass = false,
  } = Edit;
  let {moveTo} = Edit;

  if (bypass === false) {
    changeTo.time = {modified: {stamp: Nelp.timeNowString(), who: userId}};
    ['id', 'contents', 'size', 'security', 'type'].forEach(
      Key => delete changeTo[Key],
    ); // ! Security will cause a problem here if we want to change an item password.
  }

  let current;
  if (readCurrent) {
    current = await Read({userId, type: 'ID', section, nodeIds: [nodeId]});
    current = current[nodeId];
  }

  if (type === 'DATA' && changeTo) {
    changeTo.name
      ? (mongo.$push = {
          [`${section}.${nodeId}.previous`]: {
            $each: [changeTo.name],
            $slice: -5,
          },
        })
      : '';
    mongo.$set = Key_Set({pre: [`${section}.${nodeId}`], change: changeTo});

    if (
      readCurrent &&
      current.parent &&
      !current.parent.match(/home|homepage/i)
    ) {
      mongo.$set[`${section}.${current.parent}.contents.${nodeId}`] =
        Short_Contents(changeTo, current);
    }
  } else if (type === 'MOVE' && moveTo) {
    if (current.parent == moveTo) {
      return true;
    }

    mongo.$set = {};
    const external = moveTo.match(/bin|main|codex|block/); // Don't use i tag: (_MAIN_ will match 'main' if not)
    if (moveTo == 'homepage' && section == 'main') {
      moveTo = '_GENERAL_';
    }

    const newParent = external
      ? moveTo == 'main' // @ts-ignore  // moveTo can NOT be undefined at this point
        ? await Node_Get(user, {[`home.${moveTo}`]: 1}).then(
            res => res[0]['home'][moveTo as 'main'][0],
          )
        : 'homepage'
      : moveTo;

    current.parent.toLowerCase() == 'homepage' // Remove From Parents
      ? (mongo.$pull = {[`home.${section}`]: nodeId})
      : (mongo.$unset = {
          [`${section}.${current.parent}.contents.${nodeId}`]: '',
        });

    newParent.toLowerCase() == 'homepage' // Set to New Parents
      ? (mongo.$push = {[`home.${moveTo}`]: nodeId})
      : (mongo.$set[
          external
            ? `${moveTo}.${newParent}.contents.${nodeId}`
            : `${section}.${moveTo}.contents.${nodeId}`
        ] = Short_Contents(changeTo, current));

    if (external) {
      // Move between sections.
      mongo = await External_Move(
        {userId, type, section, nodeId, changeTo, moveTo, newParent},
        current,
        mongo,
      );
    } else {
      mongo.$set[`${section}.${nodeId}.parent`] = moveTo;
    }
  } else if (type === 'RESTORE') {
    let fromSection = current?.BIN_DATA?.section || 'main';
    let parentId = current?.BIN_DATA?.parent;

    let parentExists = await Read({
      userId,
      type: 'EXISTS',
      section: fromSection,
      nodeIds: [parentId],
    });
    const newParent = parentExists ? parentId : '_GENERAL_';

    mongo = await External_Move(
      {
        userId,
        type,
        section: 'bin',
        nodeId,
        changeTo,
        moveTo: fromSection,
        newParent,
      },
      current,
      mongo,
    );

    return (await Node_Set(userId, mongo)) ? parentId : '';
  } else if (type === 'DELETE') {
    // Should only be called with section bin.
    let contentsTree = await Read({
      userId,
      type: 'TREE',
      section,
      nodeIds: [nodeId],
      contents: false,
    });
    mongo.$unset = ID_Set(
      section,
      [...contentsTree.parentId, ...contentsTree.childId],
      mongo.$unset,
    );
    mongo.$pull = {[`home.bin.${subSection}`]: nodeId};

    const combinedNodes = {
      ...contentsTree.parentNode,
      ...contentsTree.childNode,
    };

    let totalTreeSize = Key_Counter(combinedNodes, 'size');
    mongo.$inc = Key_Set(
      {pre: 'size.bin', change: totalTreeSize, negative: true},
      mongo.$inc,
    );
    mongo.$inc = Key_Set(
      {pre: 'size.total', change: totalTreeSize, negative: true},
      mongo.$inc,
    );

    let sizeTotal = Object.values(totalTreeSize).reduce((a, b) => a + b, 0);
    Account.Write({
      userId,
      type: 'INCREMENT',
      parentKey: 'plan',
      childKey: 'used',
      data: -Math.abs(sizeTotal || 0),
    });

    let files = Key_Find(combinedNodes, ['type', 'file'], true);
    Object.keys(files).forEach(
      index => (files[index] = combinedNodes[index].contents),
    );

    let deleted = await Node_Set(userId, mongo);
    return deleted ? files : false;
  } else if (type === 'BIN') {
    if (!current.parent) {
      // Is Span
      if (Object.keys(current.contents).length) {
        return ['Span is not empty'];
      } else {
        mongo.$pull = {[`home.${section}`]: nodeId};
        mongo.$unset = {[`${section}.${nodeId}`]: ''};
        delete mongo.$set;
      }
    } else {
      const newParent = 'homepage';
      mongo.$set = {};
      mongo.$unset = {
        [`${section}.${current.parent}.contents.${nodeId}`]: '',
      };
      mongo = await External_Move(
        {userId, type, section, nodeId, changeTo, moveTo, newParent},
        current,
        mongo,
      );
    }
  } else {
    return;
  }

  // console.log(mongo); return;
  return await Node_Set(userId, mongo);
};

const Read = async (Query: NodeRead, project: MongoObject = {}) => {
  const {
    userId,
    type,
    section,
    subSection = '',
    nodeIds = [],
    contents,
    keys,
    internal,
  } = Query;

  if (type == 'ID') {
    // Returns either long-node of specified or its contents
    if (nodeIds[0]?.toString()?.match(/home|homepage/i)) {
      let spans = await Node_Get(userId, {[`home.${section}`]: 1});
      let projectQuery =
        spans[0]['home'][section][subSection] || spans[0]['home'][section];
      project = ID_Query({section, query: projectQuery});
    } else {
      project = ID_Query({section, query: nodeIds, contents});
    }
  } else if (type == 'RAW') {
    // Returns the long-node of items contents
    let idContents = await Node_Get(
      userId,
      ID_Query({section, query: nodeIds, contents: true}),
    );
    let listOfIds: string[] = [];
    for (const item in idContents[0][section]) {
      listOfIds = listOfIds.concat(
        Object.keys(idContents[0][section][item].contents),
      );
    }
    project = ID_Query({section, query: listOfIds});
  } else if (type == 'SPECIFIC') {
    // Returns Specific Values from Nodes
    // EXAMPLE => let Type = await Node.Read({"user": userId, "type": "SPECIFIC", "section": section, "ids": [WantedURL], "keys": ["type"]});

    nodeIds.forEach((nodeId: string) => {
      project[`${section}.${nodeId}`] = Key_Query(keys as string[]);
    });
  } else if (type == 'TREE') {
    // Returns Array of Children IDs & Children Nodes from Object
    // https://youtu.be/GQlgR_69dmI?t=620  could this help speed up this code and reduce it maybe?
    return await Get_Node_Children(nodeIds[0], {
      treeData: {size: 0, count: 0},
      parentId: [],
      parentNode: {},
      childId: [],
      childNode: {},
    });

    async function Get_Node_Children(id: string, tree: TreeNodes) {
      let node = await Node_Get(
        userId,
        ID_Query({section, query: [id], contents: false}),
      );
      node = node[0][section][id];
      if (!node) {
        return tree;
      }
      tree.treeData.size += node.size || 1;
      tree.treeData.count += 1;
      tree.parentId.length
        ? tree.childId.push(node.id)
        : tree.parentId.push(node.id);
      Object.keys(tree.parentNode).length === 0
        ? (tree.parentNode[node.id] = node)
        : (tree.childNode[node.id] = node);
      if (node.type.file === false || node.type.file == 'FOLDER') {
        let childrenIds = Object.keys(node.contents);
        for (let c = 0; c < childrenIds.length; c++) {
          await Get_Node_Children(childrenIds[c], tree);
        }
      }
      return tree;
    }
  } else if (type == 'EXISTS') {
    return Node_Exists(userId, {section, nodeId: nodeIds[0]});
  } else {
    return {error: 'Failed to Request a valid Type'};
  }

  // console.log(Project);
  let result = await Node_Get(userId, project);
  if (result[0] == 'Empty Query') return result[0];
  return section ? result[0][section] : result[0];
};

// ==============

const Custom_Read = async (query: {
  userId: UserId;
  query: any;
  section?: Sections;
}) => {
  let result = await Node_Get(query.userId, query.query);
  return query.section ? result[0][query.section] : result[0];
};

const Custom_Update = async (
  Update: NodeCustomUpdate,
  mongo: MongoObject = {},
) => {
  const {userId, action, key, CUSTOM} = Update;
  mongo[action] = {[key]: CUSTOM};
  return await Node_Set(userId, mongo);
};

// ==============

const Create = async (
  Type: NodeTypes,
  Params: any,
  Data: any,
): Promise<number | 0> => {
  const {userId, section, parent, nodeId} = Params;
  const {name, size, isFi, type, modified, options} = Data;

  // ===================================

  let node: Node | SpanNode = {
    id: nodeId || uuidv1(),
    name: Nelp.truncate(name, 128),
  };

  if (Type != 'Span') {
    // @ts-ignore   // cba working this out... just.. cba
    node = {
      ...node,
      ...{
        parent: Nelp.truncate(parent, 128),
        size: size ?? 1,
        time: {
          created: {
            stamp: Nelp.timeNowString(),
            who: userId,
          },
        },
        type: {
          file: isFi ?? false,
          mime: isFi ? type || 'text' : 'FOLDER',
        },
      },
    };
  }
  if (options) {
    node = {
      ...node,
      ...{
        security: {
          pass: Nelp.truncate(options.pass, 256) || '',
          pin: Nelp.truncate(options.pin, 256) || '',
        },
        color: options.color || '',
        description: Nelp.truncate(options.description, 512) || '',
      },
    };
  }

  // ===================================
  // @ts-ignore node.time['modified'] could be undefined. THATS FINE MR TYPESCRIPT
  modified && node.time
    ? (node.time['modified'] = {
        stamp: new Date(modified).toISOString(),
        who: userId,
      })
    : '';
  isFi
    ? (node['contents'] = {drive: UploadDrive, file: uuidv3(nodeId, userId)})
    : '';

  // ===================================

  return await Write({
    userId,
    type: Type,
    section: Nelp.validateClient('section', section) ? section : 'main',
    parent: Nelp.truncate(parent, 128) || '_GENERAL_',
    data: node,
  });
};

const Account_Setup = async (userId: UserId) => {
  let check = Node_Coll.find({userId}, {$exists: true}).limit(1).toArray();
  if (check.length) {
    console.log('Node_Account Already Exists');
    return;
  }

  Node_Account._id = userId;
  Node_Account.enc_key = crypto.randomBytes(32);

  let accountSet = await Node_Account_Set(Node_Account);

  if (accountSet) {
    ['Documents', 'Games', 'Media', 'Music', 'Notes'].forEach(async folder => {
      await Write({
        userId,
        type: 'Folder',
        section: 'main',
        parent: '_MAIN_',
        data: {
          id: uuidv1(),
          name: folder,
          parent: '_MAIN_',
          type: {
            file: false,
            mime: 'FOLDER',
          },
          time: {
            created: {
              stamp: Nelp.timeNowString(),
              who: userId,
            },
          },
        },
      });
    });
    return {result: true};
  } else {
    return {result: false, message: 'Failed to Create Account'};
  }
};

export default {
  Write,
  Edit,
  Read,
  Custom_Read,
  Custom_Update,
  Create,
  Account_Setup,
};

// ==============

const External_Move = async (
  Edit: NodeEdit,
  current: Node,
  mongo: MongoObject = {},
): Promise<MongoObject> => {
  let {
    userId,
    type,
    section,
    nodeId,
    changeTo,
    moveTo,
    newParent,
    doNotSet = false,
  } = Edit;

  let contentsTree = await Read({
    userId,
    type: 'TREE',
    section: section,
    nodeIds: [nodeId],
  });
  const combinedNodes = {
    ...contentsTree.parentNode,
    ...contentsTree.childNode,
  }; // USE ONLY FOR NON CHANGING DATA. DO NOT CHANGE THIS.
  const parentNodeId = nodeId;

  combinedNodes[parentNodeId].parent = newParent;

  if (moveTo == 'bin') {
    // Send to Bin
    mongo.$pull = {[`recent.${section}`]: nodeId};

    let links = Key_Find(combinedNodes, ['share', 'link', 'url']);
    if (links) {
      Object.keys(links).forEach(link => {
        delete combinedNodes[link].share;
      });
      removeShareLink(userId, Object.values(links));
    }

    if (current.type.mime == 'FOLDER' && !contentsTree.childId.length) {
      doNotSet = true;
    } else {
      mongo.$push = {
        [`home.bin.${section}`]: {$each: [nodeId], $position: 0},
      };

      combinedNodes[parentNodeId]['BIN_DATA'] = {
        // Set Bin Data for Recovery
        section,
        parent: current.parent,
        deleted: {stamp: Nelp.timeNowString(), who: userId},
      };

      let totalTreeSize = Key_Counter(combinedNodes, 'size');
      mongo.$inc = Key_Set(
        {pre: 'size.total', change: totalTreeSize, negative: true},
        mongo.$inc,
      );
      mongo.$inc = Key_Set(
        {pre: 'size.bin', change: totalTreeSize},
        mongo.$inc,
      );
    }
  } else if (section == 'bin') {
    // Recover from Bin
    mongo.$pull = {[`home.bin.${moveTo}`]: nodeId}; // Removes from bin parent array.
    mongo.$push = {[`recent.${moveTo}`]: nodeId}; // Adds the parent to recent to make it easier to find.

    current.parent = newParent; // Needed as Current parent is 'homepage' as it was in the bin. Thus needs changing back.

    mongo.$set = {
      [`${moveTo}.${newParent}.contents.${nodeId}`]: Short_Contents(
        changeTo,
        current,
      ),
    };

    combinedNodes[parentNodeId].parent =
      combinedNodes[parentNodeId]?.BIN_DATA?.parent || 'homepage';
    delete combinedNodes[parentNodeId]['BIN_DATA'];

    let totalTreeSize = Key_Counter(combinedNodes, 'size');
    mongo.$inc = Key_Set(
      {pre: 'size.bin', change: totalTreeSize, negative: true},
      mongo.$inc,
    );
    mongo.$inc = Key_Set(
      {pre: 'size.total', change: totalTreeSize},
      mongo.$inc,
    );
  }

  mongo.$unset = ID_Set(
    section,
    [...contentsTree.parentId, ...contentsTree.childId],
    mongo.$unset,
  );

  if (doNotSet) {
    delete mongo.$set;
    delete mongo.$push;
  } else {
    mongo.$set = Key_Set(
      {
        pre: moveTo as Sections | 'homepage' | '_GENERAL_',
        change: combinedNodes,
        move: true,
      },
      mongo.$set,
    );
  }

  return mongo;
};

// ==========================================

const Short_Contents = function (
  fir: ShortNode = {},
  sec: ShortNode = {},
): ShortNode | {} {
  return {
    ...Short_Node,
    ...{
      name: fir.name || sec.name || 'Unnamed',
      mime: fir?.type?.mime || sec?.type?.mime || 'UNKNOWN',
      size: fir.size || sec.size || 1,
      color: fir.color || sec.color || '',
      time: fir.time || sec.time || {modified: {stamp: Nelp.timeNowString()}},
    },
  };
};

const ID_Query = function (
  {section, query, contents}: IdQuery,
  created: LooseObject = {},
): MongoObject {
  if (query.length) {
    query.forEach(item => {
      item
        ? (created[`${section}.${item}${contents ? '.contents' : ''}`] = 1)
        : '';
    });
  }
  return created;
};

const ID_Set = function (
  section: Sections,
  Query: string[],
  created: LooseObject = {},
) {
  Query.forEach(item => (created[`${section}.${item}`] = ''));
  return created;
};

const Key_Query = function (Keys: string[], created: LooseObject = {}) {
  Keys.map(key => (created[key] = 1));
  return created;
};

const Key_Set = function (Set: KeySet, created: LooseObject = {}) {
  const {pre, change, move, negative} = Set;
  for (let [key, value] of Object.entries(change)) {
    if (move) {
      created[`${pre}.${key}`] = value;
    } else {
      typeof value == 'object' // @ts-ignore
        ? (created[`${pre}.${(key += '.' + Object.keys(value)[0])}`] = negative
            ? -Math.abs(value)
            : value[Object.keys(value)[0]])
        : (created[`${pre}.${key}`] = negative ? -Math.abs(value) : value);
    }
  }
  return created;
};

const Key_Counter = function (
  nodeList: {[key: string]: Node},
  wanted: 'size',
  counter: LooseObject = {},
): TotalTreeSize {
  for (const [key, node] of Object.entries(nodeList)) {
    let type = wanted == 'size' ? Nelp.baseMimeType(node.type.mime) : wanted;
    isNaN(counter?.[type])
      ? (counter[type] = ~~node[wanted])
      : (counter[type] += ~~node[wanted]);
  }
  return counter;
};

const Key_Find = function (
  nodeList: {[key: string]: Node},
  path: string[],
  match?: string | boolean | number,
) {
  // ex: ['share', 'link', 'url']
  let counter: LooseObject = {};

  for (const [key, node] of Object.entries(nodeList)) {
    let foundValue = path.reduce((a: any, b: any) => a?.[b], node);
    // ? Example:  ['share', 'link', 'url'].reduce((a,b)=>a[b], node);

    if (foundValue) {
      if (typeof match == 'undefined') counter[key] = foundValue;
      else if (foundValue === match) counter[key] = foundValue;
    }
  }
  return counter;
};

// ==========================================

const Node_Exists = async (
  userId: string,
  check: {section: Sections; nodeId: string},
) => {
  const {section, nodeId} = check;
  return await Node_Coll.findOne({
    _id: userId,
    [`${section}.${nodeId}`]: {$exists: true},
  }).then((items: any) => {
    return items ? true : false;
  });
};

const Node_Get = async (userId: string, fetch: LooseObject) => {
  return Object.keys(fetch).length == 0
    ? ['Empty Query']
    : await Node_Coll.aggregate([
        {$match: {_id: userId}},
        {$project: fetch},
      ]).toArray();
};

const Node_Set = async (userId: string, set: MongoObject) => {
  return Node_Coll.updateOne({_id: userId}, set);
};

const Node_Account_Set = async (accountData: AccountBaseNodes) => {
  return Node_Coll.insertOne(accountData)
    .then(async () => {
      return true;
    })
    .catch((err: any) => {
      console.log(`Couldn\'t Create Node Account: ${err}`);
      return false;
    });
};
