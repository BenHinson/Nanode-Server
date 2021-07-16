const fs = require('fs-extra');

const sharp = require('sharp');
const JSZip = require("jszip");
const mime = require('mime');
const { nanoid } = require('nanoid');

const Node = require('../Node/node.js');
const Helper = require('../helper.js');
const Links = require('../Account/links.js');
const Logger = require('../Middleware/Logger.js');

//////////////////////////////////////////////////////////////////////

module.exports = {
  Resize: async function(res, data, width=null, height=null) {
    sharp(data)
      .resize({fit: sharp.fit.contain, width, height})
      .toBuffer((err, data, info) => { return res.end(data); })
  },

  ZipFile: async function(res, userID, params) { // https://youtu.be/GQlgR_69dmI?t=1983  Could help reduce time to zip and server load
    const {FOR, NAME, ITEMS, SECTION} = params;

    let zip = new JSZip();
    let zipData = {"size": 0, "contents": [], "title": NAME || 'Nanode_Collection'};

    for (let i=0; i<ITEMS.length; i++) {
      let itemsTree = await Node.Read({"user": userID, "type": "TREE", "section": SECTION, "ids": [ITEMS[i]], "contents": false});
  
      await Zip_Set( itemsTree.Parent_Node[ itemsTree.Parent_Id[0]], zip);

      async function Zip_Set(Node, Parent) {
        if (Node.type.file) {
          await Write_File_To_Zip(Node, Parent, zipData);
        } else {
          SubFolder = Parent.folder(Node.name || 'Folder_'+Node.id);
          for (const [NodeID, NodeData] of Object.entries(Node.contents))  {
            await Zip_Set( itemsTree.Child_Node[ NodeID ], SubFolder )
          }
        }
      }
    }

    const ZipLink = await Links.writeDownloadLink(nanoid(24), FOR, userID, zipData);

    zip
      .generateNodeStream({type:'nodebuffer', streamFiles:true})
      .pipe(fs.createWriteStream("F:\\Nanode\\Files\\Downloads\\Nanode_"+ZipLink+".zip"))
      .on('finish', function() {
        Logger.CustomActivityLog({'Zipper': 'Finished Writing'});
        return res.status(200).send({"Link": ZipLink});
      })

    return;
    // =================================
    
    async function Write_File_To_Zip(Node, Parent, zipData) {
      await fs.promises.readFile( 'F:\\Nanode\\Files\\Mass\\'+Node.contents.file )
        .then((FileData) => {
          Parent.file( (Node.name.split('.').shift())+"."+mime.getExtension(Node.type.mime), FileData);
          zipData.size += Node.size;
          zipData.contents.push( {"Name": Node.name, "Mime": Node.type.mime} );
        })
        .catch(err => {console.log('Couldnt find file '+Node.contents.file); return 'Failed To Read'});
    }
  },
}