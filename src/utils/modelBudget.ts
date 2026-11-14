// src/utils/modelBudget.ts
// ตรวจงบขนาดโมเดลตอนรันไทม์ ใช้ค่าชุดเดียวกับสคริปต์ลดขนาด (src/config/modelBudgets.json)
import cfg from '../config/modelBudgets.json';

export type ModelCategory = keyof typeof cfg.categories;
export interface ModelBudget { label: string; maxKB: number; maxTris: number; maxTexture: number }

export const MODEL_BUDGETS = cfg.categories as Record<ModelCategory, ModelBudget>;
export const TOTAL_BUDGETS = cfg.totals;

export function categoryOf(fileOrUrl: string): ModelCategory {
  const name = fileOrUrl.split('/').pop()!.toLowerCase();
  for (const r of cfg.rules) {
    if (new RegExp(r.match, 'i').test(name)) return r.category as ModelCategory;
  }
  return 'building';
}

export type BudgetVerdict = 'ok' | 'warn' | 'reject';

export interface BudgetReport {
  verdict: BudgetVerdict;
  category: ModelCategory;
  kb: number;
  tris: number;
  message: string;
}

/**
 * ok     = อยู่ในงบ
 * warn   = เกินงบแต่ไม่เกิน hardLimitMultiplier เท่า (ยังโหลด แต่เตือนใน console)
 * reject = เกินหนักเกินไป (ไม่โหลดมาวางเป็นฉากตกแต่ง)
 */
export function checkModelBudget(url: string, byteLength: number, triangleCount: number): BudgetReport {
  const category = categoryOf(url);
  const b = MODEL_BUDGETS[category];
  const kb = Math.round(byteLength / 1024);
  const hard = cfg.hardLimitMultiplier;
  const overKb = kb / b.maxKB;
  const overTris = triangleCount / b.maxTris;
  const worst = Math.max(overKb, overTris);
  let verdict: BudgetVerdict = 'ok';
  if (worst > hard) verdict = 'reject';
  else if (worst > 1) verdict = 'warn';
  const message = `${url} [${category}] ${kb}KB/${b.maxKB}KB, ${triangleCount}/${b.maxTris} tris`;
  return { verdict, category, kb, tris: triangleCount, message };
}
