// Per-process admission: no unbounded upload/password-work queue.
export function createWorkGate(limit=4) {
  let active=0;
  function middleware(req,res,next) {
    if(active>=limit) return res.set('Retry-After','2').status(503).json({message:'The server is busy. Please retry in 2 seconds.',retryAfterSeconds:2});
    active++;let released=false;
    const release=()=>{if(!released){released=true;active--;}};
    res.once('finish',release);res.once('close',release);next();
  }
  return {middleware,active:()=>active,limit};
}
