module.exports = {
  ActivityLog: function(req, data) {
    if (req.get('host') == 'drive.nanode.one' && req.originalUrl !== '/') { return; }

    const log = {
      "path": req.protocol + '://' + req.get('host') + req.originalUrl,
      "location": req.get('cf-ipcountry'),
      "ip": req.headers['x-forwarded-for'] || req.connection.remoteAddres,
      ...data,
      "time": new Date().toLocaleString(),
    }
    console.log(log)
  },

  CustomActivityLog: function(data) {
    console.log({
      ...data,
      "time": new Date().toLocaleString(),
    });
  },
}