// src/components/ui/glassTokens.ts

// คลาสสำหรับกรอบ Modal แบบกระจกฝ้า (Glassmorphism)
export const GLASS_PILL = "bg-white/40 backdrop-blur-md border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)]";

// คลาสสำหรับวงกลมใส่ไอคอนแบบกระจก
export const GLASS_CIRCLE = "rounded-full flex items-center justify-center bg-white/30 backdrop-blur-sm border border-white/50 shadow-sm";

// คลาสสำหรับเงาข้อความแบบคมชัด (ใช้กับหัวข้อหลัก)
export const TEXT_SHARP_HALO = "drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]";

// คลาสสำหรับเงาข้อความแบบนุ่มนวล (ใช้กับข้อความทั่วไป)
export const TEXT_LIGHT_HALO = "drop-shadow-[0_0_2px_rgba(255,255,255,0.6)]";

// คลาสสำหรับปุ่มสีเหลืองอำพัน
export const BTN_AMBER = "bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-white font-black rounded-full shadow-md transition-all duration-200";