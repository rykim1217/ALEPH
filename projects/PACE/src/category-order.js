export function orderedCategories(data,planId,categories){
 const current=[...new Set(categories)],saved=data.categoryOrder?.[planId]||[];
 return [...new Set([...saved.filter(key=>current.includes(key)),...current])];
}
// Display-only grouping: keep each category's internal item order and all records intact.
export function categoryItemGroups(data,planId,items){
 const members=items.filter(item=>item.planId===planId);
 return orderedCategories(data,planId,members.map(item=>item.category)).map(category=>({category,items:members.filter(item=>item.category===category)}));
}
export function moveCategory(data,planId,categories,source,destination,after=false){
 const order=orderedCategories(data,planId,categories);
 if(source===destination||!order.includes(source)||!order.includes(destination))return data;
 order.splice(order.indexOf(source),1);order.splice(order.indexOf(destination)+(after?1:0),0,source);
 return {...data,categoryOrder:{...data.categoryOrder,[planId]:order}};
}
