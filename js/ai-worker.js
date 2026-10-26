import {choose} from './ai.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,play:choose(data.observation,Math.random,{searchMs:data.observation.difficulty==='hard'?700:0})});}catch(error){self.postMessage({id:data.id,error:error.message});}};
