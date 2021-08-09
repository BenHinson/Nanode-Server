import fse from 'fs-extra';
import sharp from 'sharp';
import JSZip from 'jszip';
import mime from 'mime'
import { nanoid } from 'nanoid';

import Node from '../Node/node';
import Links from '../Account/links';
import Logger from '../Middleware/Logger';

// ======================= TS ========================
import { Response } from 'express';

//////////////////////////////////////////////////////////////////////

const Resize = async(res:Response, data:Buffer, width:number|undefined=undefined, height:number|undefined=undefined) => {
  sharp(data)
    .resize({fit: sharp.fit.contain, width, height})
    .toBuffer((err, data:Buffer, info) => { res.end(data); })
}

const ZipFile = async(res:Response, userID:string, params:ZipParams) => {
  // https://youtu.be/GQlgR_69dmI?t=1983  Could help reduce time to zip and server load
  const {For, name, items, section} = params;

  let zip = new JSZip();
  let zipData:ZipData = {"size": 0, "contents": [], "title": name || 'Nanode_Collection'};

  for (let i=0; i<items.length; i++) {
    let itemsTree = await Node.Read({"user": userID, "type": "TREE", section, "ids": [items[i]], "contents": false});

    await Zip_Set( itemsTree.Parent_Node[ itemsTree.Parent_Id[0]], zip);

    async function Zip_Set(Node:Node, Parent:JSZip|null) {
      if (Node.type.file) {
        await Write_File_To_Zip(Node, Parent, zipData);
      } else if (Parent) { // ! Added parent here to appease typescript. May add extra folders or break zipping somehow? 
        let SubFolder = Parent.folder(Node.name || 'Folder_'+Node.id);
        for (const [NodeID, NodeData] of Object.entries(Node.contents))  {
          await Zip_Set( itemsTree.Child_Node[ NodeID ], SubFolder )
        }
      }
    }
  }

  const ZipLink = await Links.writeDownloadLink(nanoid(24), For, userID, zipData);

  zip
    .generateNodeStream({type:'nodebuffer', streamFiles:true})
    .pipe(fse.createWriteStream("F:\\Nanode\\Files\\Downloads\\Nanode_"+ZipLink+".zip"))
    .on('finish', function() {
      Logger.CustomActivityLog({'Zipper': 'Finished Writing'});
      return res.status(200).send({"Link": ZipLink});
    })

  return;
  // =================================
  
  async function Write_File_To_Zip(Node:Node, Parent:JSZip|null, zipData:ZipData) {
    await fse.promises.readFile( 'F:\\Nanode\\Files\\Mass\\'+Node.contents.file)
      .then((FileData) => { // @ts-ignore // Parent cant be null, therefor 'file' function wont exist and error.
        Parent.file( (Node.name.split('.').shift())+"."+mime.getExtension(Node.type.mime), FileData);
        zipData.size += Node.size;
        zipData.contents.push( {"Name": Node.name, "Mime": Node.type.mime} );
      })
      .catch(err => {console.log('Couldn\'t find file to Zip: '+Node.contents.file); return 'Failed To Read'});
  }
}


export default { Resize, ZipFile }