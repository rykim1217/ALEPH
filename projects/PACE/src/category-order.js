export function orderedCategories(data,planId,categories){
 const current=[...new Set(categories)],saved=data.categoryOrder?.[planId]||[];
 return [...new Set([...saved.filter(key=>current.includes(key)),...current])];
}
export function moveCategory(data,planId,categories,source,destination,after=false){
 const order=orderedCategories(data,planId,categories);
 if(source===destination||!order.includes(source)||!order.includes(destination))return data;
 order.splice(order.indexOf(source),1);order.splice(order.indexOf(destination)+(after?1:0),0,source);
 return {...data,categoryOrder:{...data.categoryOrder,[planId]:order}};
}
