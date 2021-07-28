// ======================= TS ========================
import { Request } from 'express-serve-static-core';
// =================================================== 

const ActivityLog = function(req:Request, data:Activity) {
  if (req.get('host') == 'drive.nanode.one' && req.originalUrl !== '/') { return; }

  if (data?.uID == '56d0bc91-229e-4109-9fd5-d968386518a6') { return; }

  const log = {
    "path": req.protocol + '://' + req.get('host') + req.originalUrl,
    "location": req.get('cf-ipcountry'),
    "ip": req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    ...data,
    "time": new Date().toLocaleString(),
  }
  console.log(log)
}

const CustomActivityLog = function(data:Activity) {
  console.log({
    ...data,
    "time": new Date().toLocaleString(),
  });
}


export default { ActivityLog, CustomActivityLog }