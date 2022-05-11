import fs from 'fs-extra';
import express from 'express';
const Upload_Router = express.Router();

import cors from 'cors';
import csp from 'helmet-csp';

import Nauth from '../../Middleware/Nauth';
import ReadWrite from '../../Nano/ReadWrite';
import Security from '../../Node/security';
import Send from '../send';

//////////////////////////////////////////////////////////////////////

Upload_Router.use(express.urlencoded({extended: true}));

Upload_Router.use(
  cors({
    origin: 'https://drive.nanode.one',
    methods: ['POST', 'PUT'],
  }),
);
Upload_Router.use(
  csp({
    directives: {
      connectSrc: [
        "'self'",
        'nanode.one',
        '*.nanode.one',
        'https://drive.nanode.one',
      ],
      // connectSrc: ["'self'", 'nanode.one', 'https://drive.nanode.one'],
    },
  }),
);

import formidable from 'formidable';

const form = formidable({
  multiples: true,
  uploadDir: 'F://Nanode/Files/Trail',
});

Upload_Router.post('/test_upload', Nauth.Middle, (req, res, next) => {
  const userId = req.headers.userId as UserId;
  const {message, meta, chunkInfo} = JSON.parse(req.headers.form as string);
  // const {file} = req.body;

  console.log(message, meta, chunkInfo);

  form.parse(req, (err, fields, files) => {
    if (err) {
      return next(err);
    }
    console.log(files);
    res.json({fields, files});
  });
});

module.exports = Upload_Router;

// import multer from 'multer';
// const upload = multer({limits: {fieldSize: 50 * 1024 * 1024}})

// Upload_Router.post('/test_upload', Nauth.Middle, upload.single('file'), async (req, res, next) => {
//   const userId = req.headers.userId as User;
//   const {message, meta, chunk_info} = JSON.parse(req.headers.form as string);
//   const {file} = req.body;

//   console.log(typeof file)

//   const FileData = Buffer.from(file.split`,`.map((x:string)=>+x));
//   // const FileData = Buffer.from(file);

//   fs.writeFile(meta.name, FileData);
//   fs.writeFile("2_"+meta.name, Buffer.from(file));
// })

// import multer from 'multer';
// const upload = multer({limits: {fieldSize: 50 * 1024 * 1024}})

// Upload_Router.post('/upload', Nauth.Middle, upload.none(), async (req, res, next) => {
//   const userId = req.headers.userId as User;
//   const {message, meta, chunk_info} = JSON.parse(req.headers.form as string);
//   const {file} = req.body;

//   if (meta?.parent === 'SEARCH' || !meta?.parent) return Send.Message(res, 405, {'status': 'Invalid', 'message': 'Not a valid upload destination'})

//   if (message) {
//     if (message === "Queue_Empty" && ReadWrite.UploadCheck(userId, false)) { ReadWrite.UploadCheck(userId, true); return res.sendStatus(200);}
//     else if (message === "Cancelled") { console.log("Upload Cancelled, empty Tree and Remove file chunks?"); return res.sendStatus(200); }
//   }

//   const FileData = Buffer.from(file.split`,`.map((x:string)=>+x));
//   // const FileData = Buffer.from(file);
//   const upload_chunk_size = Buffer.byteLength(FileData);

//   let Allocation = await Security.Upload_Limit(userId, upload_chunk_size, chunk_info, meta); // Checks User Plan against the upload.
//   if (Allocation.auth === false) { return Send.Message(res, 403, {"status": Allocation.msg}) }

//   if (Allocation.auth === true && FileData) {

//     // Encrypt File here
//     let result = await ReadWrite.Upload({
//       user: userId,
//       id: meta.id,
//       index: chunk_info.index,
//       total: chunk_info.totalChunks,
//       FileArray: FileData,
//     }); // :Chunk

//     if (result.chunkWrite) {
//       return Send.Message(res, 200, {"status": result.chunkWrite})
//     }
//     else if (result.written) { // Entire File written, add to Upload_Tree and request next file.
//       meta.size = Allocation.size as number;
//       meta.type = result.file_type?.mime || meta.type;
//       await ReadWrite.Write_To_User_File(userId, result.file_oID as string, meta);
//       return Send.Message(res, 200, {"status": "Complete", "plan": Allocation.plan})
//     }
//     else { return Send.Message(res, 200, {"status": 'unknown'}) }
//    } else {
//     return Send.Message(res, 403, {"status": "Incomplete"})
//   }
// })

// Upload_Router.post('/upload', Nauth.Middle, async (req, res, next) => {
//   const userId = req.headers.userId as User;
//   const {message, meta, chunk_info, file} = req.body as POST_Upload;

//   if (meta?.parent === 'SEARCH' || !meta?.parent) return Send.Message(res, 405, {'status': 'Invalid', 'message': 'Not a valid upload destination'})

//   if (message) {
//     if (message === "Queue_Empty" && ReadWrite.UploadCheck(userId, false)) { ReadWrite.UploadCheck(userId, true); return res.sendStatus(200);}
//     else if (message === "Cancelled") { console.log("Upload Cancelled, empty Tree and Remove file chunks?"); return res.sendStatus(200); }
//   }

//   const FileData = Buffer.from(file);
//   const upload_chunk_size = Buffer.byteLength(FileData);

//   let Allocation = await Security.Upload_Limit(userId, upload_chunk_size, chunk_info, meta); // Checks User Plan against the upload.
//   if (Allocation.auth === false) { return Send.Message(res, 403, {"status": Allocation.msg}) }

//   if (Allocation.auth === true && FileData) {
//     // Encrypt File here
//     let result = await ReadWrite.Upload({
//       user: userId,
//       id: meta.id,
//       index: chunk_info.index,
//       total: chunk_info.totalChunks,
//       FileArray: FileData,
//     }); // :Chunk

//     if (result.chunkWrite) {
//       return Send.Message(res, 200, {"status": result.chunkWrite})
//     }
//     else if (result.written) { // Entire File written, add to Upload_Tree and request next file.
//       meta.size = Allocation.size as number;
//       meta.type = result.file_type?.mime || meta.type;
//       await ReadWrite.Write_To_User_File(userId, result.file_oID as string, meta);
//       return Send.Message(res, 200, {"status": "Complete", "plan": Allocation.plan})
//     }
//     else { return Send.Message(res, 200, {"status": 'unknown'}) }
//    } else {
//     return Send.Message(res, 403, {"status": "Incomplete"})
//   }
// })

/// CLIENT SIDE CLIENT SIDE CLIENT SIDE CLIENT SIDE CLIENT SIDE CLIENT SIDE

// Post = async (Chunks, Upload, Info, Meta) => { // ! THIS IS TEST CODE PLEASE REMOVE ===== This code is 5 Times faster at uploading files.
//   const formData = new FormData();
//   formData.append('file', Upload.Data)

//   uploadConfig.Time_Difference = Date.now();

//   const Reply = await( await fetch('https://drive.nanode.one/test_upload', {
//     method: 'POST',
//     headers: {
//       form: JSON.stringify({
//         'meta': Meta,
//         'chunk_info': {"index": Upload.Num, "totalChunks": Info.totalChunks, "total_size": Info.total_size}
//       })
//     },
//     body: formData,
//   }) ).json();

//   N_.ClientStatus(1, "Off");

//   this.Item_Status(Reply, {Meta, "upload_num": Upload.Num, "totalChunks": Info.totalChunks, "total_size": Info.total_size}, {Chunks, Info});
// }
