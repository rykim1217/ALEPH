export const STUDY_KEY='pace.study-plans.v1';
export function emptyStudy(){return {version:1,records:[],completion:{},speeds:{},imports:[]};}
export function loadStudy(storage){const raw=storage.getItem(STUDY_KEY);if(raw===null)return emptyStudy();const value=JSON.parse(raw);if(value.version!==1||!Array.isArray(value.records)||!value.completion||!value.speeds||!Array.isArray(value.imports))throw new Error('학습 데이터 형식 오류');return value;}
export function studyItems(data){return data.records.map(record=>({...record,type:'lecture',title:['theory','programming','sql'].map((key,i)=>record.ranges[key]?['이론','프로그래밍','SQL'][i]+' '+record.ranges[key]:'').filter(Boolean).join(' · '),minutes:Math.round(record.originalMinutes/(data.speeds[record.planId]||1.5)),completed:!!data.completion[record.id]?.completed}));}
export function setStudyCompleted(data,id,completed){if(!data.records.some(r=>r.id===id))throw new Error('학습 항목 없음');return {...data,completion:{...data.completion,[id]:{completed,basis:'user',updatedAt:new Date().toISOString()}}};}
// Legacy ranges are read from saved records, never from a bundled personal outline.
function rangeNumbers(value){return String(value||'').split(',').flatMap(part=>{const text=part.trim();if(!text)return [];const match=text.match(/^(\d+(?:\.\d+)*)(?:~(\d+(?:\.\d+)*))?$/);if(!match)throw Error('기존 목차 범위를 확인해 주세요.');if(!match[2])return [match[1]];const a=match[1].split('.'),b=match[2].split('.');if(a.length!==b.length||a.slice(0,-1).join('.')!==b.slice(0,-1).join('.'))throw Error('기존 목차 범위를 확인해 주세요.');const first=Number(a.at(-1)),last=Number(b.at(-1));if(last<first||last-first>10000)throw Error('기존 목차 범위를 확인해 주세요.');const prefix=a.slice(0,-1).join('.');return Array.from({length:last-first+1},(_,i)=>(prefix?prefix+'.':'')+(first+i));});}
function savedRecordItems(data){return data.records.filter(record=>record.source==='user-supplied-table'&&record.ranges).flatMap(record=>Object.entries(record.ranges).flatMap(([category,value])=>rangeNumbers(value).map(number=>{const id=record.id+':'+category+':'+number;return {id,recordId:record.id,planId:record.planId,date:record.date,type:'lecture',category,title:(({theory:'이론',programming:'프로그래밍',sql:'SQL'})[category]||category)+' '+number,sourceStatus:record.sourceStatus,completed:data.lectureCompletion?.[id]?.completed??!!data.completion[record.id]?.completed};})));}
export function lectureItems(data){const catalogIds=new Set((data.catalog||[]).map(item=>item.id));return savedRecordItems(data).filter(item=>!catalogIds.has(item.id)).concat((data.catalog||[]).map(({legacyRecordId,...item})=>({...item,recordId:item.recordId||item.id,completed:data.lectureCompletion?.[item.id]?.completed??(legacyRecordId?!!data.completion[legacyRecordId]?.completed:false)}))).filter(item=>!data.deletedItemIds?.includes(item.id)).map(item=>({...item,...data.itemOverrides?.[item.id]}));}
export function materializeSavedStudy(data){
 const before=lectureItems(data),ids=new Set((data.catalog||[]).map(item=>item.id)),legacy=savedRecordItems(data).filter(item=>!ids.has(item.id)&&!data.deletedItemIds?.includes(item.id));if(!legacy.length)return data;
 const catalog=[...(data.catalog||[]),...legacy.map(({completed,...item})=>({...item,legacyRecordId:item.recordId}))],next={...data,catalog};
 const after=lectureItems(next),byId=new Map(after.map(item=>[item.id,item]));if(byId.size!==after.length||before.length!==after.length||before.some(item=>JSON.stringify(byId.get(item.id))!==JSON.stringify(item)))throw Error('학습 항목 변환 검증에 실패했습니다. 기존 데이터는 유지됩니다.');
 // Preserve the original display order as well as every ID and completion field.
 const order=new Map(before.map((item,index)=>[item.id,index]));next.catalog.sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));
 if(JSON.stringify(lectureItems(next))!==JSON.stringify(before))throw Error('학습 순서 변환 검증에 실패했습니다.');return next;
}
export function migrateSavedStudy(storage,{backupConfirmed=false}={}){const raw=storage.getItem(STUDY_KEY);if(raw===null)return emptyStudy();const data=loadStudy(storage),next=materializeSavedStudy(data);if(next===data||!backupConfirmed)return data;const key='pace.before-catalog-migration.v1';if(storage.getItem(key)===null)storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('이전 변환 백업과 현재 데이터가 다릅니다. 기존 데이터를 유지합니다.');if(storage.getItem(STUDY_KEY)!==raw)throw Error('학습 데이터가 변경되어 변환을 중단했습니다.');storage.setItem(STUDY_KEY,JSON.stringify(next));return next;}
export function setLectureCompleted(data,id,completed){if(!lectureItems(data).some(item=>item.id===id))throw new Error('강의 없음');return {...data,lectureCompletion:{...data.lectureCompletion,[id]:{completed,basis:'user',updatedAt:new Date().toISOString()}}};}
export function categoryDots(items){return [...new Map(items.map(item=>[item.planId+':'+item.category,item])).values()];}
// Analyze explicit lines and durations only; missing times remain unset for review.
const subjectHeading=line=>line.match(/^(\d+)\s*과목\s*[.．:]?\s*(.*)$/);
export function analyzeLectureText(text){
 const website=/시간\s*아이콘/.test(text);
 const noise=line=>/^\d+(?:\.\d+)?%$/.test(line)||/^(?:댓글\s*아이콘|댓글아이콘|영상.*아이콘|자료첨부)/.test(line);
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!noise(line));
 let category='',subject='',subjectNumber=null,subjectOrder=0,pending=null;const result=[];
 const duration=/(?:(\d+)시간\s*)?(\d+)분(?:\s*(\d+)초)?|(\d{1,3}):(\d{2})(?::(\d{2}))?/;
 for(let index=0;index<lines.length;index++){
  const line=lines[index],heading=line.match(/^(이론|프로그래밍|SQL)(?:\s*강의)?\s*[:：]?$/i);
  const numbered=subjectHeading(line);if(numbered){category=line;subject=line;subjectNumber=numbered[1];subjectOrder=0;pending=null;continue;}
  if(heading){subject='';subjectNumber=null;subjectOrder=0;category=({이론:'theory',프로그래밍:'programming',SQL:'sql'})[heading[1].toUpperCase()]||({이론:'theory',프로그래밍:'programming'})[heading[1]];pending=null;continue;}
  if(website&&!duration.test(line)&&lines[index+1]&&!duration.test(lines[index+1])){category=line;subject=line;subjectNumber=null;subjectOrder=0;pending=null;continue;}
  const time=line.match(duration);let seconds=null;
  if(time){seconds=time[4]?(time[6]!==undefined?(+time[4]*3600 + +time[5]*60 + +time[6]):(+time[4]*60 + +time[5])):((+(time[1]||0))*3600 + +time[2]*60 + +(time[3]||0));}
  const title=(time?(line.slice(0,time.index)+line.slice(time.index+time[0].length)):line).replace(/시간\s*아이콘/g,'').replace(/[|\[\]()]+/g,' ').trim();
  if(!title&&seconds!==null&&pending){pending.originalSeconds=seconds;pending=null;continue;}
  if(!title)continue;
  const prefix=website?null:title.match(/^(이론|프로그래밍|SQL)\s*/i);const cat=prefix?({이론:'theory',프로그래밍:'programming',SQL:'sql'})[prefix[1].toUpperCase()]||({이론:'theory',프로그래밍:'programming'})[prefix[1]]:category;
  subjectOrder++;pending={category:cat||'',subject,title,number:subjectNumber?subjectNumber+'.'+subjectOrder:String(result.length+1),order:result.length+1,originalSeconds:seconds};result.push(pending);
 }
 return result;
}

// Preserve explicit textbook hierarchy; unnumbered lines stay editable without invented numbers.
export function analyzeBookText(text,category){
 const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),subjects=new Set(lines.map(subjectHeading).filter(Boolean).map(match=>match[1])),multiple=subjects.size>1;let subject=null;const result=[];
 for(const line of lines){const heading=subjectHeading(line);if(heading){subject=heading[1];continue;}if(/^\d+\s*장\s*(?:[.．:：]|\s|$)/.test(line))continue;
 const numbered=line.match(/^(\d+(?:\.\d+)*)(?:[.．)]?\s+)(.+)$/),original=numbered?.[1],title=numbered?numbered[2].trim():line,number=original?(multiple&&subject&&original.split('.').length===2?subject+'.'+original:original):undefined;
 if(title)result.push({category,title,...(number?{number}:{}),order:result.length+1,originalSeconds:null,studyKind:'book'});
 }return result;
}

export function registerLectures(data,planId,rows){
 if(!planId||!rows.length)throw new Error('자격증과 등록할 강의를 확인해 주세요.');
 const identity=i=>i.studyKind==='book'&&i.number?'book:'+i.category+':'+i.number+':'+i.title.trim():i.studyKind==='past'&&i.year&&i.round?'past:'+i.year+':'+i.round:i.studyKind==='mock'&&i.round?'mock:'+(i.mockName??i.title.replace(/\s*모의고사\s*\d+회$/, '').trim())+':'+i.round:i.category+':'+i.title.replace(/^(이론|프로그래밍|SQL)\s*/i,'').replace(/\s/g,'');
 const existing=new Set(lectureItems(data).filter(i=>i.planId===planId).map(identity));const catalog=[...(data.catalog||[])];let added=0;
 for(const row of rows){if(!validExpectedMinutes(row.expectedMinutes))throw new Error('예상 시간은 0보다 큰 분 단위 숫자로 입력해 주세요.');if(!String(row.category||'').trim()||String(row.category).length>60||!row.title.trim()||(row.number!=null&&!/^\d+(?:\.\d+)*$/.test(row.number))||!Number.isInteger(row.order)||row.order<1||((!row.studyKind||row.studyKind==='lecture')&&(!Number.isFinite(row.originalSeconds)||row.originalSeconds<=0)))throw new Error('분류·제목·순서·원본시간을 확인해 주세요.');
 const key=identity(row);if(existing.has(key))continue;existing.add(key);catalog.push({...row,title:row.title.trim(),id:crypto.randomUUID(),planId,type:'lecture',source:'user-reviewed-text'});added++;
 }
 return {data:{...data,catalog},added};
}
export function analyzeStudyInput({kind,text,category,year,round}){
 if(kind==='lecture')return analyzeLectureText(text).map(row=>({...row,category:String(category||'').trim(),studyKind:kind}));
 if(kind==='past'||kind==='mock'){
  if(!/^\d+$/.test(String(round))||Number(round)<1)throw new Error('회차를 입력해 주세요.');
  if(kind==='past'&&(!/^\d{4}$/.test(String(year))||Number(year)<1900))throw new Error('연도를 입력해 주세요.');
  return [{category,title:(kind==='past'?year+'년 기출문제':'모의고사')+' '+round+'회',order:1,originalSeconds:null,studyKind:kind,year:kind==='past'?Number(year):null,round:Number(round)}];
 }
 if(kind==='book')return analyzeBookText(text,String(category||'').trim());
 if(!['book','review','other'].includes(kind))throw new Error('학습 유형을 선택해 주세요.');
 return text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((title,index)=>({category,title,order:index+1,originalSeconds:null,studyKind:kind}));
}

export function formatLectureTime(seconds){if(!Number.isInteger(seconds)||seconds<=0)return '';return [Math.floor(seconds/60)+'분',seconds%60?seconds%60+'초':''].filter(Boolean).join(' ');}
export function parseLectureTime(value){const text=value.trim();if(!text)return null;const match=text.match(/^(?:(\d+)시간\s*)?(?:(\d+)분\s*)?(?:(\d+)초)?$/);if(!match)return null;const seconds=Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0);return Number.isSafeInteger(seconds)&&seconds>0?seconds:null;}
export function generateStudyRange({kind,startYear,endYear,rounds,startRound,endRound,name='',expectedMinutes=null}){
 if(!validExpectedMinutes(expectedMinutes))throw new Error('예상 시간은 0보다 큰 분 단위 숫자로 입력해 주세요.');
 const positive=value=>/^\d+$/.test(String(value))&&Number.isSafeInteger(Number(value))&&Number(value)>0;
 let combinations=[];
 if(kind==='past'){if(!positive(startYear)||!positive(endYear)||Number(startYear)<1900||Number(endYear)>9999||Number(endYear)<Number(startYear))throw new Error('시작·종료 연도를 확인해 주세요.');if(!rounds?.length||rounds.some(r=>!positive(r)))throw new Error('등록할 회차를 선택해 주세요.');const unique=[...new Set(rounds.map(Number))].sort((a,b)=>a-b);if((Number(endYear)-Number(startYear)+1)*unique.length>1000)throw new Error('한 번에 1000개까지 생성할 수 있습니다.');for(let year=Number(startYear);year<=Number(endYear);year++)for(const round of unique)combinations.push({year,round});}
 else if(kind==='mock'){if(!positive(startRound)||!positive(endRound)||Number(endRound)<Number(startRound)||Number(endRound)-Number(startRound)>=1000)throw new Error('시작·종료 회차를 확인해 주세요.');for(let round=Number(startRound);round<=Number(endRound);round++)combinations.push({year:null,round});}else throw new Error('학습 유형을 확인해 주세요.');
 return combinations.map(({year,round},index)=>({category:kind==='past'?'기출문제':'모의고사',title:kind==='past'?year+'년 기출문제 '+round+'회':(name.trim()?name.trim()+' ':'')+'모의고사 '+round+'회',order:index+1,originalSeconds:null,expectedMinutes,studyKind:kind,year,round,mockName:kind==='mock'?name.trim():undefined}));
}

export function validExpectedMinutes(value){return value==null||typeof value==='number'&&Number.isFinite(value)&&value>0;}
export function parseExpectedMinutes(value){return String(value).trim()===''?null:Number(value);}
export function formatExpectedMinutes(value){return value!=null&&validExpectedMinutes(value)?value+'분':'';}
