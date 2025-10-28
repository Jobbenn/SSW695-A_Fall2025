import React, { useCallback, useEffect, useMemo, useState, ReactElement } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList } from 'react-native';
import Svg, { Circle, Line, Polygon, Rect } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { useFocusEffect } from '@react-navigation/native';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | 'athlete';
type Gender = 'male' | 'female' | 'other';

type Profile = {
  age?: number | null;
  gender?: Gender | null;
  pregnant?: boolean | null;
  lactating?: boolean | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  unit?: 'imperial' | 'metric' | null;
  activity_level?: ActivityLevel | null;
  body_fat_percent?: number | null;
  goal?: number | null;
};

export type GoalMap = Record<string, number>;

type OnComputedPayload = {
  totals: Record<string, number>;
  goals: GoalMap;
  calorieGoal: number | null;
  goalMode: 'lose' | 'gain' | 'maintain';
};

type TabKey = 'overview' | 'core' | 'vitamins' | 'minerals';

const CARD1_MACROS = ['total_carbs', 'protein', 'total_fats'] as const;
const CARD2_MORE_MACRO = ['omega_3', 'omega_6', 'fiber'] as const;
const CARD2_MINIMIZE = ['cholesterol', 'trans_fats', 'saturated_fats', 'added_sugar'] as const;
const CARD2_WATER = ['water'] as const;

const CARD3_MICROS = [
  'vitamin_a','vitamin_c','vitamin_d','vitamin_e','vitamin_k',
  'thiamin','riboflavin','niacin','vitamin_b6','folate',
  'vitamin_b12','pantothenic_acid','biotin','choline',
] as const;

const CARD4_MICROS = [
  'calcium','chromium','copper','fluoride','iodine','magnesium',
  'manganese','molybdenum','phosphorus','selenium','zinc',
  'potassium','sodium','chloride',
] as const;

const ALIASES: Record<string, string[]> = {
  water: ['Total Water (L/d)', 'water_total'],
  cholesterol: ['Dietary Cholesterol'],
  fiber: ['Total Fiber (g/d)', 'dietary_fiber'],
  total_carbs: ['carbs', 'carbohydrates', 'Carbohydrate', 'Carbohydrate (g/d)'],
  protein: ['Protein', 'protein_total', 'Protein (g/d)'],
  total_fats: ['Fat', 'fats', 'Fat (g/d)'],
  trans_fats: ['trans_fat', 'trans', 'trans fatty acids'],
  saturated_fats: ['saturated_fat', 'sat_fat', 'Saturated fatty acids'],
  omega_3: [
    'n-3 polyunsaturated fatty acids',
    'n-3 polyunsaturated fatty acids (α-linolenic acid)',
    'alpha_linolenic_acid',
    'α-Linolenic Acid (g/d)',
    'ala',
  ],
  omega_6: [
    'n-6 polyunsaturated fatty acids',
    'n-6 polyunsaturated fatty acids (linoleic acid)',
    'linoleic_acid',
    'Linoleic Acid (g/d)',
    'la',
  ],
  added_sugar: ['added_sugars', 'sugars_added', 'Added sugars'],
  vitamin_a: ['vit_a','vitamin_a_rae', 'Vitamin A (μg/d)'],
  vitamin_c: ['vit_c','ascorbic_acid', 'Vitamin C (mg/d)'],
  vitamin_d: ['vit_d','cholecalciferol', 'Vitamin D (μg/d)'],
  vitamin_e: ['vit_e','alpha_tocopherol', 'Vitamin E (mg/d)'],
  vitamin_k: ['vit_k','phylloquinone', 'Vitamin K (μg/d)'],
  vitamin_b6: ['b6','pyridoxine', 'Vitamin B6 (mg/d)'],
  vitamin_b12: ['b12','cobalamin', 'Vitamin B12 (μg/d)'],
  pantothenic_acid: ['pantothenate', 'Pantothenic Acid (mg/d)'],
  thiamin: ['Thiamin (mg/d)'],
  riboflavin: ['Riboflavin (mg/d)'],
  niacin: ['Niacin (mg/d)'],
  folate: ['Folate (μg/d)'],
  biotin: ['Biotin (μg/d)'],
  choline: ['Choline (mg/d)'],
  calcium: ['Calcium (mg/d)'],
  chromium: ['Chromium (μg/d)'],
  copper: ['Copper (μg/d)'],
  fluoride: ['Fluoride (mg/d)'],
  iodine: ['Iodine (μg/d)'],
  magnesium: ['Magnesium (mg/d)'],
  manganese: ['Manganese (mg/d)'],
  molybdenum: ['Molybdenum (μg/d)'],
  phosphorus: ['Phosphorus (mg/d)'],
  selenium: ['Selenium (μg/d)'],
  zinc: ['Zinc (mg/d)'],
  potassium: ['Potassium (mg/d)'],
  sodium: ['Sodium (mg/d)'],
  chloride: ['Chloride (mg/d)'],
};

// Canonical display units for each key
const UNITS: Record<string, string> = {
  // energy
  calories: 'kcal',

  // macros
  total_carbs: 'g',
  protein: 'g',
  total_fats: 'g',
  fiber: 'g',
  omega_3: 'g',
  omega_6: 'g',
  added_sugar: 'g',
  trans_fats: 'g',
  saturated_fats: 'g',
  water: 'L',

  // vitamins
  vitamin_a: 'µg',
  vitamin_c: 'mg',
  vitamin_d: 'µg',
  vitamin_e: 'mg',
  vitamin_k: 'µg',
  thiamin: 'mg',
  riboflavin: 'mg',
  niacin: 'mg',
  vitamin_b6: 'mg',
  folate: 'µg',
  vitamin_b12: 'µg',
  pantothenic_acid: 'mg',
  biotin: 'µg',
  choline: 'mg',

  // minerals
  calcium: 'mg',
  chromium: 'µg',
  copper: 'µg',
  fluoride: 'mg',
  iodine: 'µg',
  magnesium: 'mg',
  manganese: 'mg',
  molybdenum: 'µg',
  phosphorus: 'mg',
  selenium: 'µg',
  zinc: 'mg',
  potassium: 'mg',
  sodium: 'mg',
  chloride: 'mg',

  // “limit” ones that sometimes lack a numeric target
  cholesterol: 'mg',
};

async function loadCsvText(mod: any): Promise<string> {
  const asset = Asset.fromModule(mod);
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;

  return await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
}

function stripBOM(s: string) {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // handle escaped quotes ""
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const clean = stripBOM(text).replace(/\r\n/g, '\n').trim();
  const lines = clean.split('\n').filter(l => l.length);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  if (headers.length === 0) throw new Error('CSV has no headers');
  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cols[i] ?? '').trim()));
    return row;
  });
}

async function getProfile(userId: string): Promise<Profile | null> {
  try {
    // @ts-ignore dynamic import to avoid circular deps
    const { supabase } = await import('../lib/supabase');
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data as Profile;
  } catch {
    return null;
  }
}

function kgFrom(p: Profile){ return p?.weight_kg ?? null; }
function cmFrom(p: Profile){ return p?.height_cm ?? null; }

function mifflinStJeor(p: Profile): number | null {
  const w = kgFrom(p), h = cmFrom(p), age = p?.age ?? null;
  if (w == null || h == null || age == null) return null;
  const s = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
  return Math.max(800, Math.round(10*w + 6.25*h - 5*age + s));
}
function katchMcArdle(p: Profile): number | null {
  const w = kgFrom(p), bf = p?.body_fat_percent ?? null;
  if (w == null || bf == null) return null;
  const lbm = w * (1 - bf/100);
  return Math.max(800, Math.round(370 + 21.6*lbm));
}
function activityMultiplier(level?: ActivityLevel | null) {
  switch (level) {
    case 'sedentary': return 1.2;
    case 'light': return 1.375;
    case 'moderate': return 1.55;
    case 'active': return 1.725;
    case 'very_active': return 1.9;
    case 'athlete': return 2.0;
    default: return 1.2;
  }
}

function calcCalorieGoal(p: Profile): number | null {
  const bmr = p.body_fat_percent != null ? (katchMcArdle(p) ?? mifflinStJeor(p)) : mifflinStJeor(p);
  if (bmr == null) return null;

  const tdee = Math.round(bmr * activityMultiplier(p.activity_level ?? 'sedentary'));

  // Goal is a rate multiplier where 1.0 ≈ ±500 kcal/day
  const delta = Math.round((p.goal ?? 0) * 500);
  const adjusted = tdee + delta;

  // ---- HARD CAP (double safety) ----
  const minCal = p.gender === 'male' ? 1500 : 1200; // 'female' → 1200; others default to 1200
  return Math.max(minCal, adjusted);
}

function sumKey(items: any[], key: string): number {
  let t = 0;
  for (const it of items) {
    const v = it[key] ?? it.food?.[key];
    const n = Number(v);
    if (Number.isFinite(n)) t += n;
  }
  return t;
}
function sumKeyWithAliases(items: any[], key: string): number {
  const keys = [key, ...(ALIASES[key] || [])];
  for (const k of keys) {
    const s = sumKey(items, k);
    if (s !== 0) return s;
  }
  return 0;
}

// ---- helpers for "wide" RDA tables ----
function toNum(v: any): number | null {
  const n = Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Matches "19–30", "0.5–1", ">70" etc. (note: en-dash in the CSV)
function ageBandIncludes(band: string, age: number): boolean {
  const s = band.trim();
  if (!s) return false;
  if (s.startsWith('>')) {
    const n = Number(s.slice(1));
    return Number.isFinite(n) ? age > n : false;
  }
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*[–-]\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (!m) return false;
  const lo = Number(m[1]), hi = Number(m[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false;
  return age >= lo && age <= hi;
}

function lifeStageForProfile(p: Profile): 'Pregnancy' | 'Lactation' | 'Males' | 'Females' | 'Children' | 'Infants' {
  if (p.pregnant) return 'Pregnancy';
  if (p.lactating) return 'Lactation';
  const age = p.age ?? 30;
  if (age < 1) return 'Infants';
  if (age < 9) return 'Children'; // 1–8 group is in “Children”
  return (p.gender === 'female') ? 'Females' : 'Males';
}

function pickWideRdaRow(rows: Record<string, string>[], p: Profile): Record<string, string> | null {
  const stage = lifeStageForProfile(p);
  const age = p.age ?? 30;

  // The CSV uses columns: Life Stage, Age (y), then nutrient columns
  const filtered = rows.filter(r => (r['Life Stage'] || '').trim() === stage);
  // Among those, choose the one whose Age (y) band contains the user's age
  for (const r of filtered) {
    const band = (r['Age (y)'] || '').trim();
    if (band && ageBandIncludes(band, age)) return r;
  }
  // Fallback: if none match, try any row of that stage (last resort)
  return filtered[0] ?? null;
}

// Given our canonical key (e.g., "vitamin_a"), pick the first header that exists in this row
function headerForKeyInRow(k: string, row: Record<string,string>): string | null {
  const candidates = [k, ...(ALIASES[k] || [])];
  for (const c of candidates) {
    if (c in row) return c;
  }
  return null;
}

// Parse a %kcal range like "20–35" to its midpoint (return null if not parseable)
function midpointPct(s: string): number | null {
  const m = (s || '').match(/^(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lo = Number(m[1]), hi = Number(m[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return (lo + hi) / 2;
}

async function buildGoalsForProfile(p: Profile): Promise<{ goals: GoalMap; calorieGoal: number | null } | null> {
  try {
    const reqRanges = require('../assets/data/rangesMacro.csv');
    const reqMacro  = require('../assets/data/rdaMacro.csv');  // wide
    const reqAdd    = require('../assets/data/additional.csv'); // text guidance
    const reqMicro  = require('../assets/data/rdaMicro.csv');  // wide

    const [rangesText, rdaMacroText, additionalText, rdaMicroText] = await Promise.all([
      loadCsvText(reqRanges),
      loadCsvText(reqMacro),
      loadCsvText(reqAdd),
      loadCsvText(reqMicro),
    ]);

    const rangesRows   = parseCsv(rangesText);   // columns: Children 1–3, 4–18, Adults (% kcal)
    const rdaMacroRows = parseCsv(rdaMacroText); // wide: Life Stage, Age (y), nutrient cols
    const additionalRows = parseCsv(additionalText);
    const rdaMicroRows = parseCsv(rdaMicroText); // wide: Life Stage, Age (y), nutrient cols

    const goals: GoalMap = {};
    const calorieGoal = calcCalorieGoal(p);

    // ---------- A) Macronutrient % ranges (protein, total_fats, total_carbs) ----------
    // rangesMacro.csv uses age bands in its COLUMNS; pick the correct column, take midpoint %, convert to grams.
    const age = p.age ?? 30;
    const colName =
      age < 1   ? null :
      age < 4   ? 'Children, 1–3 y (% kcal)' :
      age < 19  ? 'Children, 4–18 y (% kcal)' :
                  'Adults (% kcal)';

    const rangeRowByName = (needle: string) =>
      rangesRows.find(r => (r['Macronutrient'] || '').toLowerCase() === needle.toLowerCase());

    const spec: Array<{ key: 'protein'|'total_fats'|'total_carbs', macroKcalPerGram: 4|9, label: string }> = [
      { key: 'total_fats',   macroKcalPerGram: 9, label: 'Fat' },
      { key: 'total_carbs',  macroKcalPerGram: 4, label: 'Carbohydrate' },
      { key: 'protein',      macroKcalPerGram: 4, label: 'Protein' },
    ];

    for (const { key, macroKcalPerGram, label } of spec) {
      const row = rangeRowByName(label);
      const pctStr = colName ? (row?.[colName] ?? '') : '';
      const pct = midpointPct(pctStr);
      if (pct != null && calorieGoal != null) {
        const raw = (pct / 100) * calorieGoal / macroKcalPerGram;
        const grams = Math.round(raw * 10) / 10; // keep one decimal
        goals[key] = grams;
      } else {
        console.warn('[NS] no % range for', key, 'col=', colName, 'row=', row);
      }
    }

    // ---------- B) Other macros + water from rdaMacro (wide) ----------
    // Choose the one row for this profile, then read columns.
    const macroRow = pickWideRdaRow(rdaMacroRows, p);
    if (!macroRow) console.warn('[NS] no matching life-stage row in rdaMacro');

    for (const nutrient of [...CARD2_MORE_MACRO, ...CARD2_WATER]) {
      if (!macroRow) continue;
      const header = headerForKeyInRow(nutrient, macroRow);
      const val = header ? toNum(macroRow[header]) : null;
      if (val != null) goals[nutrient] = val;
      else console.warn('[NS] no numeric rdaMacro for', nutrient, 'header=', header);
    }

    // ---------- C) “Minimize” guidance (text) ----------
    // additional.csv is advisory text; there’s no numeric limit, so we *don’t* set numeric goals.
    // (UI will still render the totals; goal will show —)
    // If you later add numeric ULs, they’ll start showing automatically here.

    // ---------- D) Micronutrients from rdaMicro (wide) ----------
    const microRow = pickWideRdaRow(rdaMicroRows, p);
    if (!microRow) console.warn('[NS] no matching life-stage row in rdaMicro');

    for (const nutrient of [...CARD3_MICROS, ...CARD4_MICROS]) {
      if (!microRow) continue;
      const header = headerForKeyInRow(nutrient, microRow);
      const val = header ? toNum(microRow[header]) : null;
      if (val != null) goals[nutrient] = val;
      else console.warn('[NS] no numeric rdaMicro for', nutrient, 'header=', header);
    }

    console.log('[NS] goals keys:', Object.keys(goals));
    return { goals, calorieGoal };
  } catch (err) {
    console.error('[NS] buildGoalsForProfile failed:', err);
    return null;
  }
}

function TabIcon({ kind, active }: { kind: 'dot' | 'square' | 'triangle' | 'diamond'; active: boolean }) {
  const size = 14;
  const stroke = active ? 'white' : '#999';
  const fill = active ? 'white' : 'transparent';

  switch (kind) {
    case 'dot':
      return (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 4} fill={fill} stroke={stroke} strokeWidth={2} />
        </Svg>
      );

    case 'square':
      return (
        <Svg width={size} height={size}>
          <Rect x={3} y={3} width={size - 6} height={size - 6} rx={3} fill={fill} stroke={stroke} strokeWidth={2} />
        </Svg>
      );

    case 'triangle':
      return (
        <Svg width={size} height={size}>
          {/* fill polygon for triangle */}
          <Polygon
            points={`${size / 2},3 ${size - 3},${size - 3} 3,${size - 3}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        </Svg>
      );

    case 'diamond':
      return (
        <Svg width={size} height={size}>
          {/* fill polygon for diamond */}
          <Polygon
            points={`${size / 2},2 ${size - 2},${size / 2} ${size / 2},${size - 2} 2,${size / 2}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        </Svg>
      );
  }
}

// Reds for "limit" nutrients
const RED = '#E85C5C';
const DEEP_RED = '#B71C1C';
const NORMAL_GREEN = '#7CC4A0';
const DEEP_GREEN_OK = '#1B7F57';
const YELLOW = '#F4D35E';
const ORANGE = '#F6A04D';

// Compute dynamic limit + color rules for the "minimize" nutrients
function limitSpec(
  key: 'added_sugar' | 'saturated_fats' | 'trans_fats' | 'cholesterol',
  totals: Record<string, number>,
  calGoal: number | null
): { goal: number | null; color: string; reverse: boolean; advisory: boolean } {
  // default return
  let goal: number | null = null;
  let color = RED;
  const reverse = true;

  if (key === 'added_sugar') {
    // 10% kcal from added sugar (4 kcal/g)
    goal = calGoal != null ? (0.10 * calGoal) / 4 : null;
    if (calGoal != null && calGoal > 0) {
      const pct = (totals.added_sugar * 4) / calGoal; // fraction of kcal
      color = pct <= 0.05 ? RED : DEEP_RED; // 0–5% red, >5–10% deep red
    } else {
      // if we can't compute, keep red
      color = RED;
    }
  } else if (key === 'saturated_fats') {
    // 10% kcal from sat fat (9 kcal/g)
    goal = calGoal != null ? (0.10 * calGoal) / 9 : null;
    if (calGoal != null && calGoal > 0) {
      const pct = (totals.saturated_fats * 9) / calGoal;
      color = pct <= 0.06 ? RED : DEEP_RED; // 0–6% red, >6–10% deep red
    } else {
      color = RED;
    }
  } else if (key === 'trans_fats') {
    // 1% kcal from trans fat (9 kcal/g) – always red
    goal = calGoal != null ? (0.01 * calGoal) / 9 : null;
    color = RED;
  } else if (key === 'cholesterol') {
    // fixed 300 mg; 0–200 red, >200–300 deep red
    goal = 300;
    const tot = totals.cholesterol ?? 0;
    color = tot <= 200 ? RED : DEEP_RED;
  }

  return { goal, color, reverse, advisory: goal == null };
}

function MiniBar({
  total,
  goal,
  label,
  innerWidth,
  unit,
  advisory = false,
  reverse = false,
  fillColor = NORMAL_GREEN,
}: {
  total: number;
  goal?: number | null;
  label: string;
  innerWidth: number;
  unit?: string;
  advisory?: boolean;
  reverse?: boolean;
  fillColor?: string;
}) {
  const width = Math.max(0, innerWidth);
  const height = 12;

  const hasGoal = !advisory && goal != null && Number(goal) > 0;
  const progress = hasGoal ? Math.min(1, total / Number(goal)) : 0;
  const fillW = hasGoal ? Math.max(2, Math.round(width * progress)) : 0;

  const reached = hasGoal && total >= Number(goal) - 1e-6;
  const barColor = reached ? DEEP_GREEN_OK : fillColor;

  // inside MiniBar (replace the existing fmt)
  const fmt = (n: number, unit?: string) => {
    if (!Number.isFinite(n)) return '—';
    const hasFraction = Math.abs(n - Math.trunc(n)) > 1e-6;
    const dp = hasFraction ? (Math.abs(n) < 1 ? 2 : 1) : 0;
    return `${n.toFixed(dp)}${unit ? ` ${unit}` : ''}`;
  };

  const rightText = hasGoal
    ? `${fmt(total, unit)} / ${fmt(Number(goal), unit)}`
    : `${fmt(total, unit)}${advisory ? ' • no numeric limit' : ''}`;

  const xPos = reverse ? Math.max(0, width - fillW) : 0;

  return (
    <View style={{ marginVertical: 6, width }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 12, color: '#666' }}>{rightText}</Text>
      </View>

      <View style={{ width, overflow: 'hidden' }}>
        <Svg width={width} height={height}>
          {/* track */}
          <Rect x={0} y={0} width={width} height={height} rx={8} fill="#EEE" />
          {/* fill (hidden if advisory or no goal) */}
          {hasGoal && (
            <Rect x={xPos} y={0} width={fillW} height={height} rx={6} fill={barColor} />
          )}
          {/* advisory outline */}
          {advisory && (
            <Rect
              x={0.5}
              y={0.5}
              width={width - 1}
              height={height - 1}
              rx={8}
              fill="none"
              stroke="#BBB"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
        </Svg>
      </View>
    </View>
  );
}

function donutColor(
  kcalTotal: number,
  kcalGoal: number | null,
  mode: 'lose' | 'gain' | 'maintain'
): string {
  if (!kcalGoal || kcalGoal <= 0) return NORMAL_GREEN;
  const r = kcalTotal / kcalGoal;

  if (mode === 'lose') {
    // deep green when goal is reached and within 5% below goal
    if (r <= 1 && r >= 0.95) return DEEP_GREEN_OK;
    // green when within 10% of goal kcal and anything below
    if (r <= 1.10) return NORMAL_GREEN;
    // >10–15% above → yellow; >15–20% → orange; >20–25% → red; >25% → deep red
    if (r <= 1.15) return YELLOW;
    if (r <= 1.20) return ORANGE;
    if (r <= 1.25) return RED;
    return DEEP_RED;
  }

  if (mode === 'gain') {
    // deep green when goal is reached and within 5% above goal
    if (r >= 1 && r <= 1.05) return DEEP_GREEN_OK;
    // green when within 10% of goal kcal and anything above
    if (r >= 0.90) return NORMAL_GREEN;
    // below goal: >10–15% → yellow; >15–20% → orange; >20–25% → red; >25% → deep red
    if (r >= 0.85) return YELLOW;      // 0.85–0.90
    if (r >= 0.80) return ORANGE;      // 0.80–0.85
    if (r >= 0.75) return RED;         // 0.75–0.80
    return DEEP_RED;                   // <0.75
  }

  // maintain
  // deep green when within 10% of goal; green otherwise
  if (r >= 0.90 && r <= 1.10) return DEEP_GREEN_OK;
  return NORMAL_GREEN;
}

function CalorieDonut({
  kcalTotal,
  kcalGoal,
  mode,
}: {
  kcalTotal: number;
  kcalGoal: number | null;
  mode: 'lose' | 'gain' | 'maintain';
}) {
  const size = 84, stroke = 10, r = (size - stroke) / 2, c = Math.PI * 2 * r;
  const progress = kcalGoal && kcalGoal > 0 ? Math.min(1, kcalTotal / kcalGoal) : 0;
  const seg = c * progress;
  const strokeColor = donutColor(kcalTotal, kcalGoal, mode);

  return (
    <View style={{ alignItems:'center', justifyContent:'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size/2} cy={size/2} r={r} stroke="#EEE" strokeWidth={stroke} fill="none"/>
        {progress > 0 && (
          <Circle
            cx={size/2}
            cy={size/2}
            r={r}
            stroke={strokeColor}          // <-- was hard-coded green
            strokeWidth={stroke}
            strokeDasharray={`${seg}, ${c - seg}`}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </Svg>
      <View style={{ position:'absolute', alignItems:'center' }}>
        <Text style={{ fontWeight:'800', fontSize:16 }}>{Math.round(kcalTotal)}</Text>
        <Text style={{ fontSize:11, color:'#666' }}>{kcalGoal ? `of ${Math.round(kcalGoal)}` : '—'}</Text>
      </View>
    </View>
  );
}

function prettyName(k: string) {
  return k.replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace('Vitamin B6','Vitamin B6')
          .replace('Vitamin B12','Vitamin B12')
          .replace('Pantothenic Acid','Pantothenic Acid');
}

const stylesNS = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
  },
  cardTitle: { fontWeight: '800', fontSize: 16, marginBottom: 6 },
});

function hasEnoughForCalories(p: Profile): boolean {
  const hasKatch =
    p.body_fat_percent != null &&
    p.weight_kg != null &&
    p.activity_level != null;

  const hasMifflin =
    p.age != null &&
    p.gender != null &&
    p.height_cm != null &&
    p.weight_kg != null &&
    p.activity_level != null;

  return !!(hasKatch || hasMifflin);
}

export default function NutritionSummary({
  items,
  theme,
  userId,
  computeDisplayCalories,
  onComputed, // <-- NEW (optional)
}: {
  items: any[];
  theme: any;
  userId?: string;
  computeDisplayCalories: (item: any) => number | null;
  onComputed?: (data: OnComputedPayload) => void;
}) {
  // keep selection stable if tabs change
  const [activeKey, setActiveKey] = useState<TabKey>('overview');
  const [listWidth, setListWidth] = useState<number>(Dimensions.get('window').width);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalMap>({});
  const [calGoal, setCalGoal] = useState<number | null>(null);
  const [goalMode, setGoalMode] = useState<'lose' | 'gain' | 'maintain'>('maintain');
  const onLayout = useCallback((e: any) => {
    const w = Math.round(e.nativeEvent.layout.width || 0);
    if (w > 0 && w !== listWidth) setListWidth(w);
  }, [listWidth]);
  const [profileBump, setProfileBump] = useState<number>(0);
  const totals = useMemo<Record<string, number>>(() => {
    const kcals = items.reduce((acc, it) => acc + (computeDisplayCalories(it) ?? 0), 0);
    const macroTotals: Record<string, number> = {};

    for (const k of [
        ...CARD1_MACROS,
        ...CARD2_MORE_MACRO,
        ...CARD2_WATER,
        ...CARD2_MINIMIZE,
        ...CARD3_MICROS,
        ...CARD4_MICROS,
    ]) {
        macroTotals[k] = sumKeyWithAliases(items, k);
    }

    // Make sure the result has an index signature
    return { calories: kcals, ...macroTotals };
  }, [items, computeDisplayCalories]);

  useEffect(() => {
    if (!userId) return;
    let channel: any;

    (async () => {
      // @ts-ignore
      const { supabase } = await import('../lib/supabase');
      channel = supabase
        .channel(`profile-watch:${userId}`) // unique per user
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          () => setProfileBump(Date.now())
        )
        .subscribe();
    })();

    return () => { channel?.unsubscribe?.(); };
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      // bump so the profile fetch effect runs
      setProfileBump(Date.now());
    }, [])
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        if (!userId) {
          console.warn('[NutritionSummary] missing userId');
          throw new Error('no user');
        }

        const profile = await getProfile(userId);
        console.log('[NutritionSummary] loaded profile:', JSON.stringify(profile));

        if (!profile) {
          console.warn('[NutritionSummary] profile not found');
          throw new Error('insufficient');
        }

        // Log which fields are missing (super handy)
        const missing: string[] = [];
        if (profile.weight_kg == null) missing.push('weight_kg');
        if (profile.activity_level == null) missing.push('activity_level');
        if (profile.body_fat_percent == null) {
          // Only needed for Katch—log but don’t require if Mifflin is possible
          missing.push('(optional) body_fat_percent');
        }
        if (profile.age == null) missing.push('(msj) age');
        if (profile.gender == null) missing.push('(msj) gender');
        if (profile.height_cm == null) missing.push('(msj) height_cm');
        console.log('[NutritionSummary] profile missing fields:', missing.join(', ') || 'none');

        if (!hasEnoughForCalories(profile)) {
          console.warn('[NutritionSummary] not enough data for calorie goal (neither Katch nor Mifflin requirements met)');
          throw new Error('insufficient');
        }

        const built = await buildGoalsForProfile(profile);
        console.log('[NutritionSummary] goals built:', built ? Object.keys(built.goals).length : 'null');

        if (!built) {
          console.error('[NutritionSummary] buildGoalsForProfile returned null (CSV load/parse?)');
          throw new Error('goals');
        }
        if (!mounted) return;

        setGoals(built.goals);
        setCalGoal(built.calorieGoal);
        setError(null);
        const gm: 'lose' | 'gain' | 'maintain' =
          (profile.goal ?? 0) > 0 ? 'gain' : (profile.goal ?? 0) < 0 ? 'lose' : 'maintain';
        setGoalMode(gm);
      } catch (e: any) {
        console.error('[NutritionSummary] error:', e?.message || e);
        setError('Finish setting up your profile in settings to see your nutrition summary.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, profileBump]);

  useEffect(() => {
    if (onComputed) {
      onComputed({
        totals,
        goals,
        calorieGoal: calGoal,
        goalMode,
      });
    }
  }, [onComputed, totals, goals, calGoal, goalMode]);

  // --- build which cards are visible (SAFE to do before early returns) ---
  const showCard2 = hasAnyData(
    [...CARD2_MORE_MACRO, ...CARD2_WATER, ...CARD2_MINIMIZE],
    totals,
    goals
  );
  const showCard3 = hasAnyData(CARD3_MICROS, totals, goals);
  const showCard4 = hasAnyData(CARD4_MICROS, totals, goals);
  const cardPadding = 12;
  const donutSize = 84;
  const gapBetweenDonutAndBars = 16;

  // width available for the bars on card 1: total card width - padding (12*2) - donut - gap
  const barsWidthCard1 = Math.max(0, listWidth - (cardPadding * 2) - donutSize - gapBetweenDonutAndBars);
  // for other cards: full card width minus padding
  const barsWidthOther = Math.max(0, listWidth - (cardPadding * 2));

  const cards = [
    <View key="card1" style={{ padding: 12 }}>
      <Text style={stylesNS.cardTitle}>Calories & Macros</Text>
      <View style={{ flexDirection:'row', alignItems:'center', gap:gapBetweenDonutAndBars, marginTop:8 }}>
        <CalorieDonut kcalTotal={totals.calories} kcalGoal={calGoal} mode={goalMode} />
        <View style={{ flex:1, minWidth: 0 }}>
          <MiniBar label="Carbs (g)"   total={totals.total_carbs} goal={goals.total_carbs} innerWidth={barsWidthCard1} unit={UNITS.total_carbs}/>
          <MiniBar label="Protein (g)" total={totals.protein}     goal={goals.protein}     innerWidth={barsWidthCard1} unit={UNITS.protein}/>
          <MiniBar label="Fat (g)"     total={totals.total_fats}  goal={goals.total_fats}  innerWidth={barsWidthCard1} unit={UNITS.total_fats}/>
        </View>
      </View>
    </View>,

    <View key="card2" style={{ padding: cardPadding }}>
      <Text style={stylesNS.cardTitle}>Essentials & Limits</Text>
      {CARD2_WATER.map(k => (
        <MiniBar key={k} label={prettyName(k)} total={totals[k]} goal={goals[k]} innerWidth={barsWidthOther} unit={UNITS[k]}/>
      ))}
      {CARD2_MORE_MACRO.map(k => (
        <MiniBar key={k} label={prettyName(k)} total={totals[k]} goal={goals[k]} innerWidth={barsWidthOther} unit={UNITS[k]}/>
      ))}
      <View style={{ height: 6 }} />
      {CARD2_MINIMIZE.map(k => {
      // dynamic goal + color + reverse fill
      const spec = limitSpec(k as any, totals, calGoal);
      const goalToUse = spec.goal ?? goals[k]; // if we couldn't compute (no calGoal), fall back to any table value
      return (
        <MiniBar
          key={k}
          label={prettyName(k) + ' (limit)'}
          total={totals[k]}
          goal={goalToUse}
          innerWidth={barsWidthOther}
          unit={UNITS[k]}
          reverse={spec.reverse}
          fillColor={spec.color}
          advisory={goalToUse == null ? true : false}
        />
      );
    })}
    </View>,

    <View key="card3" style={{ padding: cardPadding }}>
      <Text style={stylesNS.cardTitle}>Micronutrients (Vitamins)</Text>
      {CARD3_MICROS.map(k => (
        <MiniBar key={k} label={prettyName(k)} total={totals[k]} goal={goals[k]} innerWidth={barsWidthOther} unit={UNITS[k]}/>
      ))}
    </View>,

    <View key="card4" style={{ padding: cardPadding }}>
      <Text style={stylesNS.cardTitle}>Micronutrients (Minerals)</Text>
      {CARD4_MICROS.map(k => (
        <MiniBar key={k} label={prettyName(k)} total={totals[k]} goal={goals[k]} innerWidth={barsWidthOther} unit={UNITS[k]}/>
      ))}
    </View>,
  ];

  const visibleCards = [
    { key: 'overview' as const, label: 'Overview', node: cards[0] },
    ...(showCard2 ? [{ key: 'core' as const, label: 'Core', node: cards[1] }] : []),
    ...(showCard3 ? [{ key: 'vitamins' as const, label: 'Vitamins', node: cards[2] }] : []),
    ...(showCard4 ? [{ key: 'minerals' as const, label: 'Minerals', node: cards[3] }] : []),
  ] as const satisfies Array<{ key: TabKey; label: string; node: ReactElement }>;

  // Stable list of keys for the effect dependency
  const visibleKeys = useMemo<TabKey[]>(
    () => visibleCards.map(v => v.key),
    [visibleCards]
  );

  // IMPORTANT: this hook must be ABOVE any early returns
  useEffect(() => {
    if (!visibleKeys.includes(activeKey)) {
      setActiveKey(visibleKeys[0]); // 'overview' is guaranteed present
    }
  }, [activeKey, visibleKeys]);

  if (loading) return null;
  if (error) {
    return (
      <View
        style={[
          stylesNS.card,
          { width: '100%', alignSelf: 'stretch', backgroundColor: theme.card, borderColor: theme.border, marginBottom: 14 },
        ]}
      >
        <Text style={{ color: theme.text, padding: 10, marginBottom: 14 }}>{error}</Text>
      </View>
    );
  }

  const contentWidth = Math.max(0, listWidth - 100);
  function hasAnyData(keys: readonly string[], totals: Record<string, number>, goals: GoalMap) {
    return keys.some(k => (totals[k] ?? 0) > 0 || goals[k] != null);
  }

  return (
    <View style={{ marginTop: 8, marginBottom: 14, marginHorizontal: 16, alignItems: 'center' }} onLayout={onLayout}>
      {/* Tabs */}
      <View style={{ flexDirection:'row', gap:8, marginBottom: 8, flexWrap:'wrap' }}>
        {visibleCards.map((t) => {
          const active = t.key === activeKey;
          // map a shape to each tab
          const kind =
            t.key === 'overview' ? 'dot' :
            t.key === 'core' ? 'square' :
            t.key === 'vitamins' ? 'triangle' :
            'diamond';

          return (
            <View
              key={t.key}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: active ? theme.text : 'transparent',
              }}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => setActiveKey(t.key)}
            >
              <TabIcon kind={kind as any} active={active} />
            </View>
          );
        })}
      </View>

      {/* Active Card */}
      <View
        style={[
          stylesNS.card,
          {
            width: '100%',
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        {visibleCards.find(v => v.key === activeKey)?.node}
      </View>
    </View>
  );
}
