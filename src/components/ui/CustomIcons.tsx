// src/components/ui/CustomIcons.tsx
import React from 'react';

// ไอคอนจอบ (Hoe)
export const HoeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M7 21l10-10" />
    <path d="M17 11l3-7" />
    <path d="M20 4l3 3" />
    <path d="M17 11l3 3" />
    <path d="M5 19l2 2" />
  </svg>
);

// ไอคอนบัวรดน้ำ (Watering Can)
export const WateringCanIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M8 15h8v6H8z" />
    <path d="M16 16l4-4" />
    <path d="M20 12l2-1" />
    <path d="M20 12l2 1" />
    <path d="M10 15v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M8 15H6a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h2" />
  </svg>
);

// ไอคอนเคียว (Sickle)
export const SickleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10 15l-6 6" />
    <path d="M10 15c4-1 8-5 8-10" />
    <path d="M18 5l-2 2" />
    <path d="M4 21l-2 2" />
  </svg>
);

// ไอคอนถุงเมล็ดพืช (Seed Bag)
export const SeedBagIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 9h12l2 11H4z" />
    <path d="M6 9c0-3 3-5 6-5s6 2 6 5" />
    <path d="M10 14h4" />
    <circle cx="12" cy="17" r="1.5" fill="currentColor" />
    <circle cx="9" cy="18" r="1.5" fill="currentColor" />
    <circle cx="15" cy="18" r="1.5" fill="currentColor" />
  </svg>
);