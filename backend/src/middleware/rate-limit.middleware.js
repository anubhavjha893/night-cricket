import {createHmac} from 'node:crypto';
import {ipKeyGenerator} from 'express-rate-limit';
import {RateCounter} from '../models/RateCounter.js';

export const ipIdentity=req=>ipKeyGenerator(req.ip||req.socket.remoteAddress||'unknown');
const accountIdentity=req=>typeof req.body?.email==='string'
  ? `admin:${req.body.email.trim().toLowerCase()}`
  : `player:${typeof req.body?.phone==='string'?req.body.phone.replace(/[\s()-]/g,'').replace(/^(\+91|0091)/,''):'invalid'}`;

export function sharedLimiter({env,scope,windowMs,limit,key=ipIdentity,skipSuccessful=false,now=Date.now}) {
  return async function limitRequest(req,res,next) {
    const time=now(),bucket=Math.floor(time/windowMs),expiresAt=new Date((bucket+1)*windowMs);
    const id=createHmac('sha256',env.JWT_SECRET).update(`${scope}:${bucket}:${key(req)}`).digest('hex');
    let counter;
    try {
      try {counter=await RateCounter.collection.findOneAndUpdate({_id:id},{$inc:{hits:1},$setOnInsert:{expiresAt}},{upsert:true,returnDocument:'after',maxTimeMS:1000});}
      catch(error) {if(error.code!==11000)throw error;counter=await RateCounter.collection.findOneAndUpdate({_id:id},{$inc:{hits:1}},{returnDocument:'after',maxTimeMS:1000});}
    } catch {return res.set('Retry-After','2').status(503).json({message:'The registration service is temporarily unavailable. Please retry.',retryAfterSeconds:2});}
    const retry=Math.max(1,Math.ceil((expiresAt.getTime()-time)/1000));
    res.set('RateLimit',`limit=${limit}, remaining=${Math.max(0,limit-counter.hits)}, reset=${retry}`);
    if(counter.hits>limit)return res.set('Retry-After',String(retry)).status(429).json({message:`Too many requests for this action. Please retry in ${retry} seconds.`,retryAfterSeconds:retry});
    if(skipSuccessful)res.once('finish',()=>{if(res.statusCode<400)RateCounter.collection.updateOne({_id:id,hits:{$gt:0}},{$inc:{hits:-1}},{maxTimeMS:1000}).catch(()=>{});});
    next();
  };
}
const positive=(env,name,fallback)=>{const value=Number(env[name]||fallback);if(!Number.isSafeInteger(value)||value<1||value>100000)throw new Error(`Invalid ${name}.`);return value;};
export const createApiLimiter=env=>sharedLimiter({env,scope:'api-ip',windowMs:60000,limit:positive(env,'RATE_API_PER_MINUTE',600)});
export const createLoginLimiter=({env})=>[
  sharedLimiter({env,scope:'login-ip',windowMs:900000,limit:positive(env,'RATE_LOGIN_IP',180)}),
  sharedLimiter({env,scope:'login-account',windowMs:900000,limit:positive(env,'RATE_LOGIN_ACCOUNT',12),key:accountIdentity,skipSuccessful:true}),
];
export const createSubmissionLimiter=env=>sharedLimiter({env,scope:'registration-ip',windowMs:3600000,limit:positive(env,'RATE_REGISTRATION_IP',300)});
export const createQrLimiter=env=>sharedLimiter({env,scope:'qr-ip',windowMs:60000,limit:120});
export const createSearchLimiter=env=>sharedLimiter({env,scope:'admin-search',windowMs:60000,limit:120,key:req=>String(req.user._id)});
export const createFileLimiter=env=>sharedLimiter({env,scope:'private-file',windowMs:60000,limit:120,key:req=>String(req.user._id)});
