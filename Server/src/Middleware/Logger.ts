// ======================= TS ========================
import { Request } from 'express-serve-static-core';
// =================================================== 

const ActivityLog = function(req:Request, data:Activity) {
  if (req.get('host') == 'drive.nanode.one' && req.originalUrl !== '/') { return; }

  if (data?.userId == process.env.ADMIN_ID) { return; }

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