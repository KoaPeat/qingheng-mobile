// 中国内地品牌官网公开营养信息。门店、配方、规格和客制化可能造成差异。
export const CHAIN_FOOD_SOURCES = Object.freeze([
  Object.freeze({id:'mcd',brand:'麦当劳中国',shortBrand:'麦当劳',region:'中国内地',updated:'2025-04',url:'https://www.mcdonalds.com.cn/nutrition_calculator?dt_dapp=1',note:'官方数据按单份餐品计量；能量从官方千焦值按 1 kcal = 4.184 kJ 换算并取整。'}),
  Object.freeze({id:'luckin',brand:'瑞幸咖啡',shortBrand:'瑞幸',region:'中国内地',updated:'2026-10 核对',url:'https://www.lkcoffee.com/products',note:'热量来自瑞幸官网所列指定杯型、冷热、咖啡豆、甜度和奶基底；改变任一客制化选项都会改变结果。'})
]);

// 兼容旧调用；新界面使用 CHAIN_FOOD_SOURCES 展示全部来源。
export const CHAIN_FOOD_SOURCE = CHAIN_FOOD_SOURCES[0];

const sourceById=id=>CHAIN_FOOD_SOURCES.find(source=>source.id===id);
const item=(sourceId,id,name,aliases,unit,kcal,protein,carbs,fat,sodium,calcium,sourceUrl,extra={})=>{
  const source=sourceById(sourceId);
  return {id:`chain_${sourceId}_${id}`,name:`${source.shortBrand}·${name}`,aliases:[name,`${source.shortBrand}${name}`,...aliases],category:`连锁餐饮·${source.shortBrand}`,brand:source.shortBrand,base:1,unit,kcal,protein,carbs,fat,fiber:null,sodium,potassium:null,calcium,vitC:null,sourceName:`${source.brand}官网公开数据`,sourceUpdated:source.updated,sourceUrl,...extra};
};
const mcd=(...args)=>item('mcd',...args);
const luckin=(id,name,aliases,kcal,officialKcalLabel=`${kcal}`)=>item('luckin',id,name,aliases,'大杯',kcal,null,null,null,null,null,'https://www.lkcoffee.com/products',{approx:/约|–/.test(officialKcalLabel),officialKcalLabel,servingNote:'以瑞幸官网注明的杯型和客制化条件为准'});

export const CHAIN_FOODS=Object.freeze([
  mcd('big_mac','巨无霸',['Big Mac'],'个',513,27,42,26,961,171,'https://www.mcdonalds.com.cn/product/Big-Mac'),
  mcd('mcspicy','麦辣鸡腿汉堡',['麦辣鸡腿堡','麦辣堡'],'个',485,null,null,null,null,null,'https://www.mcdonalds.com.cn/know_your_icon/mcspicy-chicken-filet-burger-star-product'),
  mcd('grilled_chicken','板烧鸡腿堡',['板烧堡','原味板烧'],'个',399,null,null,null,null,null,'https://www.mcdonalds.com.cn/know_your_icon/Premium-Grilled-Chicken-Sandwich-star-product'),
  mcd('double_cheese','双层吉士汉堡',['双层芝士汉堡'],'个',429,27,31,22,1017,232,'https://www.mcdonalds.com.cn/product/double-cheeseburger'),
  mcd('cheeseburger','吉士汉堡包',['吉士汉堡','芝士汉堡'],'个',294,16,30,12,673,144,'https://www.mcdonalds.com.cn/product/Cheeseburger'),
  mcd('hamburger','汉堡包',['经典汉堡包'],'个',248,13,29,8,492,61,'https://www.mcdonalds.com.cn/product/Hamburger'),
  mcd('filet_fish','麦香鱼',['鳕鱼堡'],'个',325,16,35,13,556,99,'https://www.mcdonalds.com.cn/product/Filet-O-Fish'),
  mcd('nuggets_5','麦乐鸡（5块）',['五块麦乐鸡','麦乐鸡5块'],'份',213,12,13,12,422,9,'https://www.mcdonalds.com.cn/product/chicken-mcnuggets'),
  mcd('wings_2','麦辣鸡翅（2块）',['麦辣鸡翅2块','辣翅2块'],'份',224,13,9,15,537,13,'https://www.mcdonalds.com.cn/product/Spicy-McWings'),
  mcd('big_cutlet','那么大鸡排',['大鸡排'],'个',385,24,24,21,996,13,'https://www.mcdonalds.com.cn/product/Big-Chicken-Cutlet'),
  mcd('mini_fries','迷你薯条',['薯条迷你'],'份',106,2,14,4,61,6,'https://www.mcdonalds.com.cn/product/mini-fries'),
  mcd('small_fries','小薯条',['小薯'],'份',226,null,null,null,null,null,'https://www.mcdonalds.com.cn/know_your_icon/fries-star-product'),
  mcd('corn_small','玉米杯（小）',['小玉米杯'],'份',53,2,7,1,1,6,'https://www.mcdonalds.com.cn/product/Corn-Cup'),
  mcd('corn_large','玉米杯（大）',['大玉米杯'],'份',87,4,12,1,2,10,'https://www.mcdonalds.com.cn/product/Corn-Cup'),
  mcd('sausage_egg_muffin','猪柳蛋麦满分',['猪柳蛋麦芬'],'个',387,23,25,21,846,243,'https://www.mcdonalds.com.cn/product/Sausage-McMuffin-With-Egg'),
  mcd('double_sausage_egg_muffin','双层猪柳蛋麦满分',['双层猪柳蛋麦芬'],'个',513,29,26,32,1210,249,'https://www.mcdonalds.com.cn/product/%E5%8F%8C%E5%B1%82%E7%8C%AA%E6%9F%B3%E8%9B%8B%E9%BA%A6%E6%BB%A1%E5%88%86'),
  mcd('hash_brown','脆薯饼',['薯饼'],'个',146,1,14,9,311,7,'https://www.mcdonalds.com.cn/product/Hash-Brown'),
  mcd('grilled_chicken_muffin','原味板烧鸡腿麦满分',['板烧鸡腿麦满分'],'个',246,15,25,9,611,133,'https://www.mcdonalds.com.cn/product/Grilled-Chicken-Muffin'),
  luckin('coconut_latte','生椰拿铁',['冰生椰拿铁'],179),
  luckin('jasmine_latte','茉莉花香拿铁',['茉莉拿铁'],85,'约76–94'),
  luckin('latte_hot','拿铁（热）',['经典拿铁'],268),
  luckin('icy_coconut_latte','冰吸生椰拿铁',[],196),
  luckin('butter_latte','小黄油拿铁',['黄油拿铁'],250),
  luckin('triple_coconut_latte','生椰三重奏拿铁',['生椰三重奏'],470),
  luckin('light_coconut_jasmine','轻椰茉莉拿铁',[],120),
  luckin('velvet_latte','丝绒拿铁',[],376),
  luckin('longjing_latte','钱塘龙井拿铁',['龙井拿铁'],105),
  luckin('salted_caramel_latte','海盐焦糖拿铁',[],206,'约206'),
  luckin('gesha_dream','瑰夏之梦',[],161,'约161'),
  luckin('green_latte','绿沙沙拿铁',[],183,'约183')
]);
