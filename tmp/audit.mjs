import { topics } from './src/registry.js';

const miss=[];
for (const entry of topics){
  if (entry.type !== 'visualization') continue;
  try {
    const mod = await entry.module();
    const hasSections = !!(mod?.article && Array.isArray(mod.article.sections));
    const sec = hasSections ? mod.article.sections.length : 0;
    if (!hasSections) miss.push({id:entry.id, title:entry.title, reason:'no article.sections'});
    else if (sec === 0) miss.push({id:entry.id, title:entry.title, reason:'empty sections'});
    if (sec && sec < 5) miss.push({id:entry.id, title:entry.title, reason:`${sec} sections`});
  } catch (error) {
    miss.push({id: entry.id, title: entry.title, reason:`load error:${error.message}`});
  }
}
console.log(miss.length);
console.log(JSON.stringify(miss, null, 2));
