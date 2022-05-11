import Node from '../Node/node';

// ======================= TS ========================
import {Response} from 'express';

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

const Read_Send_Contents = async (
  NodeData: ReadSendData,
  Connection: Response,
) => {
  const {userId, type, section, subSection, contents, path} = NodeData;

  let result = await Node.Read({
    userId,
    type,
    section,
    subSection,
    nodeIds: path,
    contents,
  });

  if (result) {
    // @ts-ignore
    let directory = result[path] || result;

    if (section.match(/bin/)) {
      directory = await FormatResponse(section, directory, NodeData);
    }

    let resultFormatted = {
      Parent: {
        name: directory.name || 'homepage',
        id: directory.id || 'homepage',
      },
      Contents: directory.id
        ? {
            [directory.id]: {
              name: directory.name,
              contents: directory.contents,
            },
          } // For Folders
        : directory, // For Homepage
    };
    return Connection.send(resultFormatted);
  }
};

const Message = async (
  Connection: Response,
  status = 200,
  msg: SendMessage,
) => {
  return Connection.status(status).json(msg);
};

const Error = async (
  Error: {Message: string; Code: number},
  Connection: Response,
) => {
  return Connection.status(Error.Code || 400).send({
    error: Error.Message || 'Internal Error',
  });
};

const FormatResponse = async (
  Format: any,
  result: PublicNode | 'Empty Query',
  NodeData: any,
) => {
  if (result != 'Empty Query') {
    let fileTree;

    for (const [id, data] of Object.entries(result)) {
      if (Format == 'bin') {
        result[id] = {
          name: data.name,
          size: data.size,
          type: data.type,
          // @ts-ignore // I dont understand why data.BIN_DATA.deleted does not work
          deleted: data.BIN_DATA.deleted,
        };
      } else if (Format == 'binInfo') {
        if (!data.type.file) {
          fileTree = await Node.Read({
            userId: NodeData.userId,
            type: 'TREE',
            section: NodeData.section,
            nodeIds: [id],
            contents: false,
          });
        }
        let itemParent = await Node.Read({
          userId: NodeData.userId,
          type: 'SPECIFIC',
          section: data.BIN_DATA.section,
          nodeIds: [data.BIN_DATA.parent],
          keys: ['name', 'description'],
        });

        result[id] = {
          name: data.name,
          // @ts-ignore // NO idea here either
          parent: itemParent[data.BIN_DATA.parent] || 'Deleted',
          size: fileTree?.treeData.size || data.size,
          type: data.type,
          time: data.time,
          deleted: data.BIN_DATA.deleted,
          count: fileTree?.treeData.count || 1,
        };
      }
    }
  }
  return result;
};

export default {Read_Send_Contents, Message, Error, FormatResponse};
