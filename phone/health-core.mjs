export const SEX_OPTIONS = Object.freeze(['male', 'female']);
export const BODY_MODES = Object.freeze({
  fat_loss: Object.freeze({ id: 'fat_loss', label: '减脂', calorie: [0.8, 0.9], protein: [1.6, 2.2], fat: [0.25, 0.3], description: '降低体脂，并通过较高蛋白和抗阻训练帮助保留肌肉。' }),
  weight_loss: Object.freeze({ id: 'weight_loss', label: '减重', calorie: [0.8, 0.9], protein: [1.2, 1.6], fat: [0.25, 0.3], description: '降低总体体重，适合优先关注体重趋势的人。' }),
  muscle_gain: Object.freeze({ id: 'muscle_gain', label: '增肌', calorie: [1.05, 1.1], protein: [1.6, 2.2], fat: [0.25, 0.3], description: '配合渐进抗阻训练，以小幅热量盈余增加肌肉。' }),
  weight_gain: Object.freeze({ id: 'weight_gain', label: '增重', calorie: [1.1, 1.2], protein: [1.2, 1.6], fat: [0.25, 0.35], description: '合理提高总体体重，兼顾能量密度和膳食质量。' })
});
export const ACTIVITY_LEVELS = Object.freeze({
  sedentary: Object.freeze({ id: 'sedentary', label: '久坐/很少运动', factor: 1.2 }),
  light: Object.freeze({ id: 'light', label: '轻度活动（每周1–3次）', factor: 1.375 }),
  moderate: Object.freeze({ id: 'moderate', label: '中度活动（每周3–5次）', factor: 1.55 }),
  high: Object.freeze({ id: 'high', label: '高活动（每周6–7次）', factor: 1.725 })
});
export const SPECIAL_CONDITIONS = Object.freeze(['none', 'pregnant', 'lactating', 'medical']);
export const NUTRITION_STATUS = Object.freeze({
  severe_low: Object.freeze({ label: '明显不足', color: '#B14560', icon: '↓' }),
  low: Object.freeze({ label: '轻度不足', color: '#D89A40', icon: '↘' }),
  ideal: Object.freeze({ label: '合理摄入', color: '#247764', icon: '✓' }),
  high: Object.freeze({ label: '轻度超量', color: '#D77A59', icon: '↗' }),
  severe_high: Object.freeze({ label: '明显超量', color: '#963F55', icon: '↑' })
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 0) => Number(value.toFixed(digits));

export function calculateAge(birthMonth, referenceDate = new Date()) {
  if (!/^\d{4}-\d{2}$/.test(String(birthMonth || ''))) return null;
  const [year, month] = birthMonth.split('-').map(Number);
  const current = referenceDate instanceof Date ? referenceDate : new Date(`${referenceDate}T12:00:00`);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 1900) return null;
  let age = current.getFullYear() - year;
  if (current.getMonth() + 1 < month) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

export function normalizeHealthSettings(raw = {}, defaults) {
  const clean = { ...defaults };
  for (const key of ['baselineKg', 'heightCm', 'age', 'goalMinKg', 'goalMaxKg']) {
    const value = raw?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) clean[key] = value;
  }
  clean.sex = SEX_OPTIONS.includes(raw?.sex) ? raw.sex : defaults.sex;
  clean.birthMonth = /^\d{4}-\d{2}$/.test(String(raw?.birthMonth || '')) ? raw.birthMonth : (defaults.birthMonth || '');
  const calculatedAge = calculateAge(clean.birthMonth);
  if (calculatedAge !== null) clean.age = calculatedAge;
  clean.activityLevel = ACTIVITY_LEVELS[raw?.activityLevel] ? raw.activityLevel : (defaults.activityLevel || 'light');
  clean.bodyMode = BODY_MODES[raw?.bodyMode] ? raw.bodyMode : (defaults.bodyMode || 'fat_loss');
  clean.specialCondition = SPECIAL_CONDITIONS.includes(raw?.specialCondition) ? raw.specialCondition : (defaults.specialCondition || 'none');
  clean.usesWearableActivity = raw?.usesWearableActivity === true;
  const interval = Number(raw?.weighIntervalDays);
  clean.weighIntervalDays = Number.isInteger(interval) && interval >= 1 && interval <= 30 ? interval : defaults.weighIntervalDays;
  return clean;
}

export function calculateBmr(settings) {
  const age = calculateAge(settings.birthMonth) ?? finite(settings.age, 30);
  const offset = settings.sex === 'female' ? -161 : 5;
  return Math.round(10 * finite(settings.baselineKg, 70) + 6.25 * finite(settings.heightCm, 170) - 5 * age + offset);
}

export function calculateExpenditure(settings, options = {}) {
  const bmr = calculateBmr(settings);
  const activityLevel = ACTIVITY_LEVELS[settings.activityLevel] || ACTIVITY_LEVELS.light;
  const actualActivity = Number.isFinite(options.actualActivity) ? Math.max(0, options.actualActivity) : null;
  const tef = Number.isFinite(options.intakeKcal) ? Math.max(0, Math.round(options.intakeKcal * 0.08)) : 0;
  if (actualActivity !== null) return { bmr, activity: actualActivity, tef, total: bmr + actualActivity + tef, source: 'wearable', activityFactor: null };
  return { bmr, activity: null, tef: 0, total: Math.round(bmr * activityLevel.factor), source: 'factor', activityFactor: activityLevel.factor };
}

export function calculateNutritionTargets(settings, options = {}) {
  const weight = clamp(finite(settings.baselineKg, 70), 20, 400);
  const age = calculateAge(settings.birthMonth, options.referenceDate || new Date()) ?? finite(settings.age, 30);
  const mode = BODY_MODES[settings.bodyMode] || BODY_MODES.fat_loss;
  const expenditure = calculateExpenditure(settings, options);
  const calorie = [Math.round(expenditure.total * mode.calorie[0]), Math.round(expenditure.total * mode.calorie[1])];
  const protein = [round(weight * mode.protein[0]), round(weight * mode.protein[1])];
  const fat = [round(calorie[0] * mode.fat[0] / 9), round(calorie[1] * mode.fat[1] / 9)];
  const carbs = [Math.max(0, round((calorie[0] - protein[1] * 4 - fat[1] * 9) / 4)), Math.max(0, round((calorie[1] - protein[0] * 4 - fat[0] * 9) / 4))];
  const restrictions = [];
  if (age < 18) restrictions.push('未成年人不适用成人减脂/增肌目标，请由监护人与专业人员评估。');
  if (settings.specialCondition === 'pregnant') restrictions.push('孕期不自动给出减重目标，请以产科或注册营养师建议为准。');
  if (settings.specialCondition === 'lactating') restrictions.push('哺乳期能量与营养需求不同，请以专业建议为准。');
  if (settings.specialCondition === 'medical') restrictions.push('存在特殊健康状况时，目标仅作记录参考，请遵循医生或营养师方案。');
  return { mode, age, expenditure, calorie, protein, carbs, fat, fiber: [25, 35], sodium: [0, 2000], potassium: settings.sex === 'female' ? [2600, 3600] : [3000, 4000], calcium: [800, 1200], vitC: settings.sex === 'female' ? [75, 120] : [90, 140], restrictions, suitable: restrictions.length === 0 };
}

export function getNutrientStatus(value, range, options = {}) {
  const amount = Math.max(0, finite(value, 0));
  const low = Math.max(0, finite(range?.[0], 0));
  const high = Math.max(low, finite(range?.[1], low));
  let id;
  if (options.maximumOnly) {
    if (amount <= high) id = 'ideal'; else if (amount <= high * 1.2) id = 'high'; else id = 'severe_high';
  } else if (amount < low * 0.6) id = 'severe_low'; else if (amount < low) id = 'low'; else if (amount <= high) id = 'ideal'; else if (amount <= high * 1.2) id = 'high'; else id = 'severe_high';
  const meta = NUTRITION_STATUS[id];
  return { id, ...meta, value: amount, low, high, position: high ? clamp(amount / (high * 1.35) * 100, 0, 100) : 0 };
}

export function scaleNutrition(base, changes = {}) {
  const originalAmount = Math.max(0.0001, finite(base.amount, 1));
  const amount = Math.max(0, finite(changes.amount, originalAmount));
  const servings = Math.max(0, finite(changes.servings, 1));
  const density = clamp(finite(changes.densityPercent, 100), 1, 500) / 100;
  const edible = clamp(finite(changes.ediblePercent, 100), 0, 100) / 100;
  const factor = amount / originalAmount * servings * density * edible;
  const result = { amount, servings, densityPercent: density * 100, ediblePercent: edible * 100, factor };
  for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'potassium', 'calcium', 'vitC']) result[key] = Number.isFinite(base[key]) ? round(base[key] * factor, 2) : null;
  return result;
}

export function calculateTrendCalibration(weightHistory = {}, intakeHistory = {}, settings, referenceDate = new Date()) {
  const end = referenceDate instanceof Date ? new Date(referenceDate) : new Date(`${referenceDate}T12:00:00`);
  const cutoff = new Date(end); cutoff.setDate(cutoff.getDate() - 27);
  const points = Object.entries(weightHistory).filter(([date, weight]) => Number.isFinite(weight) && new Date(`${date}T12:00:00`) >= cutoff && new Date(`${date}T12:00:00`) <= end).map(([date, weight]) => ({ date, weight, day: Math.round((new Date(`${date}T12:00:00`) - cutoff) / 86400000) })).sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 4 || (new Date(`${points.at(-1).date}T12:00:00`) - new Date(`${points[0].date}T12:00:00`)) / 86400000 < 13) return { ready: false, days: points.length, message: '至少需要跨越14天的4次晨重，才能进行趋势校准。' };
  const n = points.length, sx = points.reduce((s, p) => s + p.day, 0), sy = points.reduce((s, p) => s + p.weight, 0);
  const sxy = points.reduce((s, p) => s + p.day * p.weight, 0), sxx = points.reduce((s, p) => s + p.day * p.day, 0);
  const weeklyKg = round(((n * sxy - sx * sy) / Math.max(1, n * sxx - sx * sx)) * 7, 2);
  const days = Object.keys(intakeHistory).filter(date => date >= points[0].date && date <= points.at(-1).date && Number.isFinite(intakeHistory[date]));
  const averageIntake = days.length ? round(days.reduce((sum, date) => sum + intakeHistory[date], 0) / days.length) : null;
  const observedDailyBalance = round(weeklyKg * 7700 / 7);
  const inferredExpenditure = averageIntake === null ? null : Math.round(averageIntake - observedDailyBalance);
  const expected = calculateExpenditure(settings).total;
  const adjustment = inferredExpenditure === null ? null : clamp(Math.round(inferredExpenditure - expected), -400, 400);
  return { ready: true, days: points.length, weeklyKg, averageIntake, inferredExpenditure, expectedExpenditure: expected, adjustment, message: '趋势只用于小幅校准；水分、经期、盐分和训练会影响结果。' };
}

export function addIsoDays(date, days) {
  const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days);
  const year = value.getFullYear(), month = String(value.getMonth() + 1).padStart(2, '0'), day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeighSchedule(referenceDate, weightHistory = {}, intervalDays = 1) {
  const interval = Number.isInteger(intervalDays) && intervalDays >= 1 && intervalDays <= 30 ? intervalDays : 1;
  const dates = Object.entries(weightHistory).filter(([date, weight]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= referenceDate && Number.isFinite(weight)).map(([date]) => date).sort();
  const lastDate = dates.at(-1) || null;
  if (!lastDate) return { due: true, recordedToday: false, lastDate: null, nextDate: referenceDate, intervalDays: interval };
  const recordedToday = lastDate === referenceDate, nextDate = addIsoDays(lastDate, interval);
  return { due: !recordedToday && referenceDate >= nextDate, recordedToday, lastDate, nextDate, intervalDays: interval };
}
