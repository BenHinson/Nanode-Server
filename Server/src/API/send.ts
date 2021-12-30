import Node from '../Node/node'

// ======================= TS ========================
import { Response } from 'express';

//////////////////////////////////////////////////////////////////////
///////////////////     CONNECTIONS & SERVE    ///////////////////////
//////////////////////////////////////////////////////////////////////

const Read_Send_Contents = async(NodeData:ReadSendData, Connection:Response) => {
  const {userID, type, section, subSection, contents, path} = NodeData;

  let Result = await Node.Read({'user':userID, type, section, subSection, "ids": path, contents});
  
  if (Result) {
    // @ts-ignore
    let Directory = Result[path] || Result;
    
    if (section.match(/bin/)) {
      Directory = await FormatResponse(section, Directory, NodeData);
    }
    
    let Result_Formatted = {
      "Parent": {"name": Directory.name || "homepage", "id": Directory.id || "homepage"},
      "Contents": Directory.id
        ? { [Directory.id]: { "name": Directory.name, "contents": Directory.contents } } // For Folders
        : Directory // For Homepage
    }
    return Connection.send(Result_Formatted);
  }
}

const Message = async(Connection:Response, status=200, msg:SendMessage) => {
  return Connection.status(status).json(msg);
}

const Error = async(Error:{'Message':string, 'Code':number}, Connection:Response) => {
  return Connection.status(Error.Code || 400).send({'error': Error.Message || 'Internal Error'});
}

const FormatResponse = async(Format:any, Result:PublicNode|'Empty Query', NodeData:any) => {
  if (Result != 'Empty Query') {
    let fileTree;

    for (const [id, data] of Object.entries(Result)) {
      if (Format == 'bin') {
        Result[id] = {
          'name': data.name,
          'size': data.size,
          'type': data.type,
          // @ts-ignore // I dont understand why data.BIN_DATA.deleted does not work
          'deleted': data.BIN_DATA.deleted
        };
      }
      else if (Format == 'binInfo') {
        if (!data.type.file) {
          fileTree = await Node.Read({"user": NodeData.user, "type": 'TREE', "section": NodeData.section, "ids": [id], "contents": false});
        }
        let itemParent = await Node.Read({"user": NodeData.user, "type": 'SPECIFIC', 'section': data.BIN_DATA.section, "ids": [data.BIN_DATA.parent], "keys": ["name", "description"]});

        Result[id] = {
          'name': data.name,
          // @ts-ignore // NO idea here either
          'parent': itemParent[data.BIN_DATA.parent] || 'Deleted',
          'size': fileTree?.Tree_Data.size || data.size,
          'type': data.type,
          'time': data.time,
          'deleted': data.BIN_DATA.deleted,
          'count': fileTree?.Tree_Data.count || 1,
        }
      }
    }
  }
  return Result;
}

export default { Read_Send_Contents, Message, Error, FormatResponse }