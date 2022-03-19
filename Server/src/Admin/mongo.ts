// TO START THE MONGOOSE / MONGO SERVER
// Command Prompt     : cd /d F:\Nanode\MongoDB\bin & mongod.exe --dbpath "F:\\Nanode\MongoDB\data\db"
// To Open Local CMD  : Ctrl+Shift+C

// const MongoClient = require('mongodb').MongoClient;

import {MongoClient} from 'mongodb';

const nanodeURL:string = process.env.NANODE_URL!;
const nauthURL:string = process.env.NAUTH_URL!;
const nodeURL:string = process.env.NODE_URL!;

const collections: MDBCollections = {};
const databases: MDBDatabases = {}

// --------------------------------------------------------------------------

export const connectToServer = async(callback: any) => {
  MongoClient.connect( nanodeURL,  {useUnifiedTopology: true, useNewUrlParser: true }, (err:string, client:any) => {
    console.log("Nanode MongoDB Connected...");

    databases["nanode"] = client.db('Nanode');

    collections["account"] = databases["nanode"].collection('Accounts');
    collections["link"] = databases["nanode"].collection('Links');
    collections["download"] = databases["nanode"].collection('Downloads');
    // collections["nano"] = databases["nanode"].collection('Nano');
  });
  
  MongoClient.connect( nauthURL, {useUnifiedTopology: true, useNewUrlParser: true }, (err:string, client:any) => {
    console.log("Nauth MongoDB Connected...");

    databases["Nauth"] = client.db('Nauth');

    // return callback();
  });

  MongoClient.connect( nodeURL, {useUnifiedTopology: true, useNewUrlParser: true }, (err:string, client:any) => {
    console.log("Node MongoDB Connected...");
    databases["node"] = client.db('Node');
    collections["node"] = databases["node"].collection('Node');

    return callback();
  })
}

export const getColl = (collection: 'account'|'link'|'download'|'node') => {
  return collections[collection];
}

export const getDB = (database: 'nanode'|'Nauth'|'node') => {
  return databases[database];
}