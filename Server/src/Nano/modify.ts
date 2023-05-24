import fse from 'fs-extra';
import sharp from 'sharp';
import JSZip from 'jszip';
import mime from 'mime';

import {nanoid} from 'nanoid';
import {v1 as uuidv1} from 'uuid';

import Node from '../Node/node';
import Links from '../Account/links';
import Logger from '../Middleware/Logger';
import {WriteThumbnail} from './ReadWrite';

// ======================= TS ========================
import {Response} from 'express';

//////////////////////////////////////////////////////////////////////

const Resize = async (res: Response, data: Buffer, nodeData: LooseObject) => {
  // We can presume: the item is an IMAGE. We want to RESIZE it. There is NO PREVIEW.
  const width = nodeData.resize.width,
    height = nodeData.resize.height;

  sharp(data)
    .resize({fit: sharp.fit.contain, width, height})
    .toBuffer(async (err, data: Buffer, info) => {
      if (width === 120 && height === 90) {
        // Write thumbnail to the drive and then add it to the files node data.
        const thumbnailId = uuidv1();
        if (await WriteThumbnail(thumbnailId, data)) {
          Node.Edit({
            userId: nodeData.userId,
            type: 'DATA',
            section: nodeData.section,
            nodeId: nodeData.nodeId,
            changeTo: {contents: {thumbnail: thumbnailId}},
            bypass: true,
            readCurrent: false,
          });
        } else {
          console.log('Failed to write thumbnail?');
        }
      }
      res.end(data);
    });
};

const ZipFile = async (res: Response, userId: string, params: ZipParams) => {
  // https://youtu.be/GQlgR_69dmI?t=1983  Could help reduce time to zip and server load
  const {forUser, name, items, section} = params;

  let zip = new JSZip();
  let zipData: ZipData = {
    size: 0,
    contents: [],
    title: name || 'Nanode_Collection',
  };

  for (let i = 0; i < items.length; i++) {
    let itemsTree = await Node.Read({
      userId,
      type: 'TREE',
      section,
      nodeIds: [items[i]],
      contents: false,
    });

    await Zip_Set(itemsTree.parentNode[itemsTree.parentId[0]], zip);

    async function Zip_Set(node: Node, parent: JSZip | null) {
      if (node.type.file) {
        await Write_File_To_Zip(node, parent, zipData);
      } else if (parent) {
        // ! Added parent here to appease typescript. May add extra folders or break zipping somehow?
        let subFolder = parent.folder(node.name || 'Folder_' + node.id);
        for (const [nodeId, nodeData] of Object.entries(node.contents)) {
          await Zip_Set(itemsTree.childNode[nodeId], subFolder);
        }
      }
    }
  }

  const zipLink = await Links.writeDownloadLink(
    nanoid(24),
    forUser,
    userId,
    zipData,
  );

  zip
    .generateNodeStream({type: 'nodebuffer', streamFiles: true})
    .pipe(
      fse.createWriteStream(
        'F:\\Nanode\\Files\\Downloads\\Nanode_' + zipLink + '.zip',
      ),
    )
    .on('finish', function () {
      Logger.CustomActivityLog({zipper: 'Finished Writing'});
      return res.status(200).send({Link: zipLink});
    });

  return;
  // =================================

  async function Write_File_To_Zip(
    Node: Node,
    Parent: JSZip | null,
    zipData: ZipData,
  ) {
    await fse.promises
      .readFile('F:\\Nanode\\Files\\Mass\\' + Node.contents.file)
      .then(FileData => {
        // @ts-ignore // Parent cant be null, therefor 'file' function wont exist and error.
        Parent.file(
          Node.name.split('.').shift() + '.' + mime.extension(Node.type.mime),
          FileData,
        );
        zipData.size += Node.size;
        zipData.contents.push({Name: Node.name, Mime: Node.type.mime});
      })
      .catch(err => {
        console.log("Couldn't find file to Zip: " + Node.contents.file);
        return 'Failed To Read';
      });
  }
};

export default {Resize, ZipFile};
