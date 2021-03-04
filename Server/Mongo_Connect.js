// TO START THE MONGOOSE / MONGO SERVER
// Command Prompt : cd /d F:\Nanode\MongoDB\bin
// Then :          mongod.exe --dbpath "F:\\Nanode\MongoDB\data\db"

const MongoClient = require('mongodb').MongoClient;

const Nanode_URL = "mongodb://localhost:27017/Nanode";
const Nord_URL = "mongodb://localhost:27017/Nord";

const Node_URL = "mongodb://localhost:27017/Node";

const Collections = {};
const Databases = {}

// --------------------------------------------------------------------------

module.exports = {

  connectToServer: async(callback) => {
    MongoClient.connect( Nanode_URL,  {useUnifiedTopology: true, useNewUrlParser: true }, function( err, client ) {
      console.log("Nanode MongoDB Connected...");

      Databases["nanode"] = client.db('Nanode');

      Collections["account"] = Databases["nanode"].collection('Accounts');
      Collections["link"] = Databases["nanode"].collection('Links');
      Collections["download"] = Databases["nanode"].collection('Downloads');
      Collections["nano"] = Databases["nanode"].collection('Nano');
    });
    MongoClient.connect( Nord_URL, {useUnifiedTopology: true, useNewUrlParser: true }, function( err, client ) {
      console.log("Nord MongoDB Connected...");

      Databases["nord"] = client.db('Nord');

      // return callback();
    });

    MongoClient.connect( Node_URL, {useUnifiedTopology: true, useNewUrlParser: true }, function( err, client ) {
      console.log("Node MongoDB Connected...");
      Databases["node"] = client.db('Node');

      return callback();
    })
  },

  getColl: function(collection) {
    return Collections[collection];
  },

  getDB: function(database) {
    return Databases[database];
  }
}