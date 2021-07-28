// TO START THE MONGOOSE / MONGO SERVER
// Command Prompt     : cd /d F:\Nanode\MongoDB\bin & mongod.exe --dbpath "F:\\Nanode\MongoDB\data\db"
// To Open Local CMD  : Ctrl+Shift+C

// const MongoClient = require('mongodb').MongoClient;

import {MongoClient} from 'mongodb';

const Nanode_URL:string = "mongodb://localhost:27017/Nanode";
const Node_URL:string = "mongodb://localhost:27017/Node";
const Nord_URL:string = "mongodb://localhost:27017/Nord";

const Collections: MDB_Collections = {};
const Databases: MDB_Databases = {}

// --------------------------------------------------------------------------

export const connectToServer = async(callback: any) => {
  MongoClient.connect( Nanode_URL,  {useUnifiedTopology: true, useNewUrlParser: true }, (err:string, client:any) => {
    console.log("Nanode MongoDB Connected...");

    Databases["nanode"] = client.db('Nanode');

    Collections["account"] = Databases["nanode"].collection('Accounts');
    Collections["link"] = Databases["nanode"].collection('Links');
    Collections["download"] = Databases["nanode"].collection('Downloads');
    // Collections["nano"] = Databases["nanode"].collection('Nano');
  });
  MongoClient.connect( Nord_URL, {useUnifiedTopology: true, useNewUrlParser: true }, (err:string, client:any) => {
    console.log("Nord MongoDB Connected...");

    Databases["nord"] = client.db('Nord');

    // return callback();
  });

  MongoClient.connect( Node_URL, {useUnifiedTopology: true, useNewUrlParser: true }, (err:string, client:any) => {
    console.log("Node MongoDB Connected...");
    Databases["node"] = client.db('Node');
    Collections["node"] = Databases["node"].collection('Node');

    return callback();
  })
}

export const getColl = (collection: 'account'|'link'|'download'|'node') => {
  return Collections[collection];
}

export const getDB = (database: 'nanode'|'nord'|'node') => {
  return Databases[database];
}