import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { StyleSheet, View, Alert, useColorScheme, Text, Pressable, ScrollView, Keyboard } from 'react-native'
import { Button, Input, Slider } from 'react-native-elements'
import { Session } from '@supabase/supabase-js'
import { Ionicons } from '@expo/vector-icons'
import SafeScreen from './SafeScreen'
import { Colors } from '../constants/theme'
import Avatar from '../components/Avatar'

type Unit = 'imperial' | 'metric'
type Gender = 'male' | 'female' | 'other'
type Activity =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'
  | 'athlete'

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true)

  // Existing
  const [username, setUsername] = useState('')
  const [website] = useState('') // kept for API parity; hidden from UI
  const [avatarUrl, setAvatarUrl] = useState('')
  const [goalX10, setGoalX10] = useState<number>(0); // -20..20
  const goal = goalX10 / 10; // derived decimal for display/save

  // New fields (UI state)
  const [unit, setUnit] = useState<Unit>('metric')
  const [age, setAge] = useState<string>('')                     // as text for easier input
  const [gender, setGender] = useState<Gender>('male')
  const [pregnant, setPregnant] = useState<boolean>(false)
  const [lactating, setLactating] = useState<boolean>(false)
  const [activityLevel, setActivityLevel] = useState<Activity>('sedentary')
  const [bodyFatPct, setBodyFatPct] = useState<string>('')

  // Weight/Height shown in the UI (convert on the fly)
  const [weightDisplay, setWeightDisplay] = useState<string>('') // lbs or kg depending on unit

  // Height as either cm (metric) or ft/in (imperial)
  const [heightCmDisplay, setHeightCmDisplay] = useState<string>('') // only used in metric
  const [heightFt, setHeightFt] = useState<string>('')               // only used in imperial
  const [heightIn, setHeightIn] = useState<string>('')               // only used in imperial

  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme ?? 'light']

  // --- helpers: conversions ---
  const KG_PER_LB = 0.45359237
  const CM_PER_IN = 2.54
  const CM_PER_FT = 30.48

  const toKg = (lbs: number) => lbs * KG_PER_LB
  const toLbs = (kg: number) => kg / KG_PER_LB
  const cmFromFtIn = (ft: number, inch: number) => ft * CM_PER_FT + inch * CM_PER_IN
  const ftInFromCm = (cm: number) => {
    const ft = Math.floor(cm / CM_PER_FT)
    const remCm = cm - ft * CM_PER_FT
    const inch = Math.round(remCm / CM_PER_IN)
    return { ft, inch }
  }

  // Pull profile
  useEffect(() => {
    if (session) getProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  function activityMultiplier(level?: Activity | null) {
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

  function hasEnoughForCaloriesLocal(): boolean {
    // enough for Mifflin (same idea as NutritionSummary)
    const hasAge   = !!age && !Number.isNaN(Number(age));
    const hasWtKg  = !!weightDisplay && !Number.isNaN(Number(unit === 'imperial' ? toKg(Number(weightDisplay)) : Number(weightDisplay)));
    const hasHtCm  =
      (unit === 'imperial'
        ? (!!heightFt && !Number.isNaN(Number(heightFt)))
        : (!!heightCmDisplay && !Number.isNaN(Number(heightCmDisplay))));
    const hasAct   = !!activityLevel;

    return hasAge && hasWtKg && hasHtCm && hasAct && !!gender;
  }

  function currentKgCm(): { kg: number | null; cm: number | null } {
    let kg: number | null = null;
    let cm: number | null = null;

    if (unit === 'imperial') {
      const lbs = Number(weightDisplay);
      if (!Number.isNaN(lbs)) kg = Number(toKg(lbs).toFixed(3));
      const ft  = Number(heightFt) || 0;
      const inch = Number(heightIn) || 0;
      const cmTmp = cmFromFtIn(ft, inch);
      if (cmTmp > 0) cm = Number(cmTmp.toFixed(2));
    } else {
      const kgVal = Number(weightDisplay);
      if (!Number.isNaN(kgVal)) kg = Number(kgVal.toFixed(3));
      const cmVal = Number(heightCmDisplay);
      if (!Number.isNaN(cmVal)) cm = Number(cmVal.toFixed(2));
    }
    return { kg, cm };
  }

  function mifflinLocal(kg: number, cm: number, ageNum: number, genderLocal: Gender): number {
    const s = genderLocal === 'male' ? 5 : genderLocal === 'female' ? -161 : -78;
    return Math.max(800, Math.round(10*kg + 6.25*cm - 5*ageNum + s));
  }

  async function getProfile() {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      const { data, error, status } = await supabase
        .from('profiles')
        .select(`
          username,
          avatar_url,
          unit,
          age,
          gender,
          pregnant,
          lactating,
          weight_kg,
          height_cm,
          activity_level,
          body_fat_percent,
          goal
        `)
        .eq('id', session.user.id)
        .single()

      if (error && status !== 406) throw error

      if (data) {
        setUsername(data.username ?? '')
        setAvatarUrl(data.avatar_url ?? '')

        const dbUnit: Unit = (data.unit as Unit) ?? 'metric'
        setUnit(dbUnit)

        setAge(data.age != null ? String(data.age) : '')
        setGender((data.gender as Gender) ?? 'male')
        setPregnant(!!data.pregnant)
        setLactating(!!data.lactating)
        setActivityLevel((data.activity_level as Activity) ?? 'sedentary')
        setBodyFatPct(
          data.body_fat_percent != null ? String(Number(data.body_fat_percent)) : ''
        )
        setGoalX10(Math.round(((typeof data.goal === 'number' ? data.goal : 0) * 10)));

        const weightKg = typeof data.weight_kg === 'number' ? data.weight_kg : undefined
        const heightCm = typeof data.height_cm === 'number' ? data.height_cm : undefined

        if (dbUnit === 'imperial') {
          // show lbs + ft/in
          setWeightDisplay(weightKg != null ? String(Math.round(toLbs(weightKg))) : '')
          if (heightCm != null) {
            const { ft, inch } = ftInFromCm(heightCm)
            setHeightFt(String(ft))
            setHeightIn(String(inch))
            setHeightCmDisplay('') // not used
          } else {
            setHeightFt('')
            setHeightIn('')
          }
        } else {
          // show kg + cm
          setWeightDisplay(weightKg != null ? String(Number(weightKg.toFixed(1))) : '')
          setHeightCmDisplay(heightCm != null ? String(Number(heightCm.toFixed(1))) : '')
          setHeightFt('')
          setHeightIn('')
        }
      }
    } catch (err) {
      if (err instanceof Error) Alert.alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Flip units and convert current UI values
  function onChangeUnit(next: Unit) {
    if (next === unit) return
    if (next === 'imperial') {
      // metric -> imperial
      const kg = parseFloat(weightDisplay)
      if (!Number.isNaN(kg)) setWeightDisplay(String(Math.round(toLbs(kg))))

      const cm = parseFloat(heightCmDisplay)
      if (!Number.isNaN(cm)) {
        const { ft, inch } = ftInFromCm(cm)
        setHeightFt(String(ft))
        setHeightIn(String(inch))
      }
      setHeightCmDisplay('')
    } else {
      // imperial -> metric
      const lbs = parseFloat(weightDisplay)
      if (!Number.isNaN(lbs)) setWeightDisplay(String((toKg(lbs)).toFixed(1)))

      const ft = parseFloat(heightFt)
      const inch = parseFloat(heightIn)
      if (!Number.isNaN(ft) && !Number.isNaN(inch)) {
        setHeightCmDisplay(String(cmFromFtIn(ft, inch).toFixed(1)))
      } else if (!Number.isNaN(ft) && Number.isNaN(inch)) {
        setHeightCmDisplay(String((ft * CM_PER_FT).toFixed(1)))
      }
      setHeightFt('')
      setHeightIn('')
    }
    setUnit(next)
  }
  
  // dynamic lower bound for goalX10 (−20..20 slider ticks = tenths)
  const dynamicMinX10 = useMemo(() => {
    if (!hasEnoughForCaloriesLocal()) return -20; // not enough info -> no enforcement here

    const { kg, cm } = currentKgCm();
    const ageNum = Number(age);
    if (kg == null || cm == null || Number.isNaN(ageNum)) return -20;

    const bmr  = mifflinLocal(kg, cm, ageNum, gender);
    const tdee = Math.round(bmr * activityMultiplier(activityLevel));
    const minCal = gender === 'male' ? 1500 : 1200;

    // goal (in whole units) * 500 = delta kcal
    // adjusted = tdee + delta >= minCal
    // => goal >= (minCal - tdee) / 500
    let minGoal = (minCal - tdee) / 500;

    // cannot be below −2 by design, and if TDEE < minCal then you cannot lose at all
    if (minGoal > 0) minGoal = 0;

    // slider is tenths → round to nearest integer tick
    const clamped = Math.max(-2, minGoal);
    return Math.round(clamped * 10); // x10 space
  }, [unit, weightDisplay, heightFt, heightIn, heightCmDisplay, age, gender, activityLevel]);

  // if the current value is below the dynamic minimum, lift it up
  useEffect(() => {
    if (goalX10 < dynamicMinX10) {
      setGoalX10(dynamicMinX10);
    }
  }, [dynamicMinX10, goalX10]);

  async function updateProfile({
    username,
    avatar_url,
  }: {
    username: string
    avatar_url: string
  }) {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      // Normalize to metric for DB:
      let weight_kg: number | null = null
      let height_cm: number | null = null

      if (unit === 'imperial') {
        const lbs = parseFloat(weightDisplay)
        if (!Number.isNaN(lbs)) weight_kg = Number((toKg(lbs)).toFixed(3))

        const ft = parseFloat(heightFt) || 0
        const inch = parseFloat(heightIn) || 0
        const cm = cmFromFtIn(ft, inch)
        if (cm > 0) height_cm = Number(cm.toFixed(2))
      } else {
        const kg = parseFloat(weightDisplay)
        if (!Number.isNaN(kg)) weight_kg = Number(kg.toFixed(3))

        const cm = parseFloat(heightCmDisplay)
        if (!Number.isNaN(cm)) height_cm = Number(cm.toFixed(2))
      }

      const updates = {
        id: session.user.id,
        username,
        avatar_url,
        updated_at: new Date(),
        unit, // store preference
        age: age ? Number(age) : null,
        gender,
        pregnant,
        lactating,
        weight_kg,
        height_cm,
        activity_level: activityLevel,
        body_fat_percent: bodyFatPct ? Number(bodyFatPct) : null,
        goal: goal,
      }

      const { error } = await supabase.from('profiles').upsert(updates)
      if (error) throw error

      Alert.alert('Profile updated!')
    } catch (err) {
      if (err instanceof Error) Alert.alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const unitChips = useMemo(
    () => (
      <View style={styles.row}>
        {(['metric', 'imperial'] as Unit[]).map((opt) => {
          const active = unit === opt
          return (
            <Pressable
              key={opt}
              onPress={() => onChangeUnit(opt)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? theme.primary : 'transparent',
                  borderColor: theme.text,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              hitSlop={8}
            >
              <Text style={{ color: theme.text }}>
                {opt === 'metric' ? 'Metric' : 'Imperial'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    ),
    [unit, theme]
  )

  function BoolToggle({
    label,
    value,
    onChange,
  }: {
    label: string
    value: boolean
    onChange: (v: boolean) => void
  }) {
    return (
      <View style={{ marginTop: 12, marginLeft: 10 }}>
        <Text style={[styles.label, { color: theme.text, fontWeight: 'bold', fontSize: 16 }]}>{label}</Text>
        <View style={styles.row}>
          {[
            { k: 'No', v: false },
            { k: 'Yes', v: true },
          ].map((o) => {
            const active = value === o.v
            return (
              <Pressable
                key={o.k}
                onPress={() => onChange(o.v)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.primary : 'transparent',
                    borderColor: theme.text,
                  },
                ]}
              >
                <Text style={{ color: theme.text }}>
                  {o.k}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }

  function EnumChips<T extends string>({
    label,
    value,
    options,
    onChange,
    pretty,
  }: {
    label: string
    value: T
    options: T[]
    onChange: (v: T) => void
    pretty?: Record<string, string>
  }) {
    return (
      <View style={{ marginTop: 12, marginLeft: 10 }}>
        <Text style={[styles.label, { color: theme.text, fontWeight: 'bold', fontSize: 16}]}>{label}</Text>
        <View style={styles.rowWrap}>
          {options.map((opt) => {
            const active = value === opt
            return (
              <Pressable
                key={opt}
                onPress={() => onChange(opt)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.primary : 'transparent',
                    borderColor: theme.text,
                  },
                ]}
              >
                <Text style={{ color: theme.text }}>
                  {pretty?.[opt] ?? opt}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }

  return (
    <SafeScreen>
      <View style={{ flex: 1 }}>
        <View>
          {/* Avatar */}
          <View style={[styles.verticallySpaced, styles.mt30, styles.horizontallyCentered]}>
            <Avatar
              size={200}
              url={avatarUrl}
              onUpload={(url: string) => {
                setAvatarUrl(url)
                updateProfile({ username, avatar_url: url })
              }}
            />
          </View>

          {/* Email (read-only) */}
          <View style={[styles.verticallySpaced, styles.mt30]}>
            <Input
              label="Email"
              labelStyle={{ color: theme.text }}
              leftIcon={<Ionicons name="mail-outline" size={22} color={theme.text} />}
              value={session?.user?.email ?? ''}
              disabled
              placeholderTextColor={theme.text}
              inputStyle={{ color: theme.text }}
              inputContainerStyle={{ borderBottomColor: theme.text }}
            />
          </View>

          {/* Username */}
          <View style={styles.verticallySpaced}>
            <Input
              label="Username"
              labelStyle={{ color: theme.text }}
              leftIcon={<Ionicons name="person-outline" size={22} color={theme.text} />}
              value={username}
              onChangeText={setUsername}
              placeholderTextColor={theme.text}
              inputStyle={{ color: theme.text }}
              inputContainerStyle={{ borderBottomColor: theme.text }}
            />
          </View>
          
          {/* Age + Gender row */}
          <View style={[styles.verticallySpaced, { flexDirection: 'row', gap: 12 }]}>
            {/* Age */}
            <View style={{ width: 100 }}>
              <Input
                label="Age"
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
                labelStyle={{ color: theme.text }}
                inputStyle={{ color: theme.text }}
                inputContainerStyle={{ borderBottomColor: theme.text }}
              />
            </View>

            {/* Gender */}
            <View style={{ flex: 1, justifyContent: 'center', marginTop: -32, marginLeft: 28 }}>
              <EnumChips<Gender>
                label="Gender"
                value={gender}
                options={['male', 'female', 'other']}
                onChange={setGender}
                pretty={{ male: 'Male', female: 'Female', other: 'Other' }}
              />
            </View>
          </View>

          {/* Pregnant + Lactating Row */}
          <View style={[styles.verticallySpaced, { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }]}>
              {/* Pregnant / Lactating */}
            <BoolToggle label="Pregnant" value={pregnant} onChange={setPregnant} />
            <BoolToggle label="Lactating" value={lactating} onChange={setLactating} />
          </View>

          {/* Unit + Weight Row */}
          <View style={[styles.verticallySpaced, { flexDirection: 'row', justifyContent: 'space-between' }]}>
              {/* Weight */}
              <View style={[styles.verticallySpaced, {width: 150, }]}>
                <Input
                  label={`Weight (${unit === 'imperial' ? 'lb' : 'kg'})`}
                  keyboardType="decimal-pad"
                  value={weightDisplay}
                  onChangeText={setWeightDisplay}
                  labelStyle={{ color: theme.text }}
                  inputStyle={{ color: theme.text }}
                  inputContainerStyle={{ borderBottomColor: theme.text }}
                />
              </View>

              {/* Unit preference */}
              <View style={{ marginTop: 8, marginLeft: 10 }}>
                <Text style={[styles.label, { color: theme.text, fontWeight: 'bold', fontSize: 16 }]}>Unit</Text>
                {unitChips}
              </View>
          </View>

          {/* Height */}
          {unit === 'imperial' ? (
            <View style={[styles.row, styles.verticallySpaced]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input
                  label="Height (ft)"
                  keyboardType="number-pad"
                  value={heightFt}
                  onChangeText={setHeightFt}
                  labelStyle={{ color: theme.text }}
                  inputStyle={{ color: theme.text }}
                  inputContainerStyle={{ borderBottomColor: theme.text }}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Input
                  label="Height (in)"
                  keyboardType="number-pad"
                  value={heightIn}
                  onChangeText={setHeightIn}
                  labelStyle={{ color: theme.text }}
                  inputStyle={{ color: theme.text }}
                  inputContainerStyle={{ borderBottomColor: theme.text }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.verticallySpaced}>
              <Input
                label="Height (cm)"
                keyboardType="decimal-pad"
                value={heightCmDisplay}
                onChangeText={setHeightCmDisplay}
                labelStyle={{ color: theme.text }}
                inputStyle={{ color: theme.text }}
                inputContainerStyle={{ borderBottomColor: theme.text }}
              />
            </View>
          )}

          {/* Activity Level */}
          <EnumChips<Activity>
            label="Activity Level"
            value={activityLevel}
            onChange={setActivityLevel}
            options={[
              'sedentary',
              'light',
              'moderate',
              'active',
              'very_active',
              'athlete',
            ]}
            pretty={{
              sedentary: 'Sedentary',
              light: 'Light',
              moderate: 'Moderate',
              active: 'Active',
              very_active: 'Very Active',
              athlete: 'Athlete',
            }}
          />

          {/* Body Fat % */}
          <View style={[styles.verticallySpaced, {marginTop: 30}]}>
            <Input
              label="Body Fat %"
              keyboardType="decimal-pad"
              value={bodyFatPct}
              onChangeText={setBodyFatPct}
              labelStyle={{ color: theme.text }}
              inputStyle={{ color: theme.text }}
              inputContainerStyle={{ borderBottomColor: theme.text }}
            />
          </View>

          {/* Goal (weight change rate) */}
          <View style={{ marginTop: 16, marginLeft: 10, marginRight: 16 }}>
            <Text style={[styles.label, { color: theme.text, fontWeight: 'bold', fontSize: 16 }]}>
              Goal
            </Text>
            <Text style={{ color: theme.text, marginBottom: 6 }}>
              {goal > 0 ? `Gain ~${Math.round(goal * 500)} kcal/day` :
              goal < 0 ? `Lose ~${Math.round(Math.abs(goal) * 500)} kcal/day` :
              'Maintain'}
            </Text>

            <Slider
              value={goalX10}
              onValueChange={(v: number) => {
                // v is an integer tick in x10 space; enforce dynamic minimum in real time
                const next = Math.max(dynamicMinX10, Math.min(20, Math.round(v)));
                setGoalX10(next);
              }}
              minimumValue={dynamicMinX10}  // dynamic lower bound (in x10 ticks)
              maximumValue={20}
              step={1}
              thumbTintColor={theme.primary}
              minimumTrackTintColor={theme.text}
              maximumTrackTintColor={theme.text}
              thumbStyle={{ height: 24, width: 24 }}
              trackStyle={{ height: 3,  }}
            />

            {/* Tick marks / labels */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              {[-20, -15, -10, -5, 0, 5, 10, 15, 20].map((t) => (
                <Text key={t} style={{ color: theme.text, fontSize: 12 }}>
                  {(t / 10).toFixed(1)}
                </Text>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View style={[styles.verticallySpaced, styles.mt20]}>
            <Button
              buttonStyle={[styles.authButtons, { backgroundColor: theme.primary, borderColor: theme.text }]}
              title={loading ? 'Loading ...' : 'Update'}
              titleStyle={[{ color: theme.text }]}
              onPress={() => updateProfile({ username, avatar_url: avatarUrl })}
              disabled={loading}
            />
          </View>

          <View style={styles.verticallySpaced}>
            <Button
              buttonStyle={[styles.authButtons, { backgroundColor: theme.primary, borderColor: theme.text }]}
              title="Sign Out"
              titleStyle={[{ color: theme.text }]}
              onPress={() => supabase.auth.signOut()}
            />
          </View>
        </View>
      </View>
    </SafeScreen>
  )
}

const styles = StyleSheet.create({
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  horizontallyCentered: {
    alignSelf: 'center',
  },
  mt20: {
    marginTop: 20,
  },
  mt30: {
    marginTop: 30,
  },
  authButtons: {
    borderWidth: 1,
    borderRadius: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '600',
  },
})
