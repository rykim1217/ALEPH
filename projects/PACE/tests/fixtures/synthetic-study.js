import {emptyStudy} from '../../src/study.js';
// Generated test-only data; no actual user dates, titles or completion history.
export function importStudy(data,plans){const plan=plans[0];if(!plan)return {data,plans};const records=Array.from({length:16},(_,index)=>({id:'synthetic-'+index,planId:plan.id,date:'2040-01-'+String(index+1).padStart(2,'0'),ranges:{theory:'1~3',programming:index<12?'1~4':'1~3',sql:''},originalMinutes:120,sourceStatus:'test',source:'user-supplied-table'}));return {data:{...emptyStudy(),...data,records:[...data.records,...records]},plans};}
