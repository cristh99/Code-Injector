#!/usr/bin/env node
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const sha=(b)=>createHash('sha256').update(b).digest('hex');
const EXP=new Uint8Array(512),LOG=new Int16Array(256).fill(-1);let x=1;
for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d;}for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
const mul=(a,b)=>a===0||b===0?0:EXP[LOG[a]+LOG[b]];
const inv=(a)=>{if(!a)throw new Error('ARCA_GF_INVERSE_ZERO');return EXP[255-LOG[a]];};
const pow=(a,n)=>n===0?1:a===0?0:EXP[(LOG[a]*n)%255];
const identity=(n)=>Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>r===c?1:0));
function matrixMultiply(a,b){return Array.from({length:a.length},(_,r)=>Array.from({length:b[0].length},(_,c)=>{let v=0;for(let k=0;k<b.length;k++)v^=mul(a[r][k],b[k][c]);return v;}));}
function matrixInvert(m){const n=m.length,aug=m.map((row,r)=>[...row,...identity(n)[r]]);for(let c=0;c<n;c++){let p=c;while(p<n&&!aug[p][c])p++;if(p===n)throw new Error('ARCA_MATRIX_SINGULAR');[aug[p],aug[c]]=[aug[c],aug[p]];const q=inv(aug[c][c]);for(let j=0;j<2*n;j++)aug[c][j]=mul(aug[c][j],q);for(let r=0;r<n;r++){if(r===c||!aug[r][c])continue;const f=aug[r][c];for(let j=0;j<2*n;j++)aug[r][j]^=mul(f,aug[c][j]);}}return aug.map(r=>r.slice(n));}
function generator(k,m){const v=Array.from({length:k+m},(_,r)=>Array.from({length:k},(_,c)=>pow(r+1,c)));return matrixMultiply(v,matrixInvert(v.slice(0,k)));}
function combine(coeff,shards,size){const out=Buffer.alloc(size);for(let s=0;s<coeff.length;s++){if(!coeff[s])continue;for(let i=0;i<size;i++)out[i]^=mul(coeff[s],shards[s][i]);}return out;}
function canonical(v){if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);if(typeof v==='number'){if(!Number.isSafeInteger(v))throw new Error('ARCA_CANONICAL_NUMBER');return String(v);}if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;throw new Error('ARCA_CANONICAL_VALUE');}
function leaf(d){return Buffer.from(sha(Buffer.concat([Buffer.from([0]),Buffer.from(canonical(d))])),'hex');}
function merkle(ds){let level=ds.map(leaf);while(level.length>1){const next=[];for(let i=0;i<level.length;i+=2){const l=level[i],r=level[i+1]??l;next.push(Buffer.from(sha(Buffer.concat([Buffer.from([1]),l,r])),'hex'));}level=next;}return level[0].toString('hex');}
function valid(m){try{if(m.format!=='arca-manifest-v1'||m.generator!=='systematic-vandermonde-v1'||m.gf_polynomial!==285||m.total_shards!==m.data_shards+m.parity_shards||m.shards.length!==m.total_shards)return false;if(merkle(m.shards)!==m.merkle_root)return false;const h=m.manifest_sha256,{manifest_sha256,...rest}=m;return sha(Buffer.from(canonical(rest)))===h;}catch{return false;}}
const parseSet=(v)=>new Set(v?String(v).split(',').filter(Boolean).map(Number):[]);
const [manifestFile,shardDir,outFile,...flags]=process.argv.slice(2);if(!manifestFile||!shardDir||!outFile){console.error('USAGE recover.mjs <manifest> <shardDir> <out> [--missing=] [--corrupt=]');process.exit(2);}
const opt=Object.fromEntries(flags.filter(v=>v.startsWith('--')).map(v=>{const [k,x='']=v.slice(2).split('=',2);return[k,x];}));
try{
 const m=JSON.parse(await readFile(manifestFile,'utf8'));if(!valid(m))throw new Error('ARCA_MANIFEST_INVALID');
 const missing=parseSet(opt.missing),corrupt=parseSet(opt.corrupt),files=new Set(await readdir(shardDir)),available=[];
 for(const d of m.shards){if(missing.has(d.index))continue;const name=`shard-${String(d.index).padStart(3,'0')}.bin`;if(!files.has(name))continue;const b=Buffer.from(await readFile(join(shardDir,name)));if(corrupt.has(d.index)&&b.length)b[0]^=255;if(b.length===d.size&&sha(b)===d.sha256)available.push([d.index,b]);}
 if(available.length<m.data_shards)throw new Error('ARCA_INSUFFICIENT_VALID_SHARDS');const chosen=available.slice(0,m.data_shards),g=generator(m.data_shards,m.parity_shards),decode=matrixInvert(chosen.map(([i])=>g[i])),bufs=chosen.map(([,b])=>b),data=decode.map(row=>combine(row,bufs,m.shard_size));
 const encoded=Buffer.concat(data).subarray(0,m.encoded_size);if(sha(encoded)!==m.encoded_sha256)throw new Error('ARCA_ENCODED_HASH_MISMATCH');const original=m.compression==='gzip'?gunzipSync(encoded):encoded;if(original.length!==m.original_size||sha(original)!==m.original_sha256)throw new Error('ARCA_ORIGINAL_HASH_MISMATCH');await writeFile(outFile,original);console.log(JSON.stringify({status:'RECOVERED',bytes:original.length,original_sha256:m.original_sha256,output:outFile}));
}catch(e){console.log(JSON.stringify({status:'FAIL_CLOSED',error:e.message}));process.exit(2);}
