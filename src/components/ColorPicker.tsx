import React, { useState, useRef, useEffect } from 'react';
import { Check, Pipette, ChevronDown, Sparkles } from 'lucide-react';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
  compact?: boolean;
}

export const POPULAR_COLORS = [
  { name: 'Xanh Ngọc (Emerald)', value: '#10b981' },
  { name: 'Xanh Lá (Green)', value: '#22c55e' },
  { name: 'Xanh Rừng (Forest)', value: '#059669' },
  { name: 'Xanh Lục Bình (Teal)', value: '#14b8a6' },
  { name: 'Xanh Cyan', value: '#06b6d4' },
  { name: 'Xanh Da Trời (Sky)', value: '#0ea5e9' },
  { name: 'Xanh Dương (Blue)', value: '#3b82f6' },
  { name: 'Xanh Chàm (Indigo)', value: '#6366f1' },
  { name: 'Tím Hoa Cà (Violet)', value: '#8b5cf6' },
  { name: 'Tím Quý Phái (Purple)', value: '#a855f7' },
  { name: 'Hồng Fuchsia', value: '#d946ef' },
  { name: 'Hồng Phấn (Pink)', value: '#ec4899' },
  { name: 'Đỏ Hồng (Rose)', value: '#f43f5e' },
  { name: 'Đỏ Ruby (Red)', value: '#ef4444' },
  { name: 'Cam Năng Động (Orange)', value: '#f97316' },
  { name: 'Vàng Hổ Phách (Amber)', value: '#f59e0b' },
  { name: 'Vàng Nắng (Yellow)', value: '#eab308' },
  { name: 'Xám Than (Slate)', value: '#64748b' },
];

export const PASTEL_COLORS = [
  { name: 'Bạc hà nhạt', value: '#6ee7b7' },
  { name: 'Xanh lơ nhạt', value: '#7dd3fc' },
  { name: 'Oải hương nhạt', value: '#c4b5fd' },
  { name: 'Hồng phấn pastel', value: '#f9a8d4' },
  { name: 'Cam đào pastel', value: '#fdba74' },
  { name: 'Vàng bơ pastel', value: '#fde047' },
];

export default function ColorPicker({
  value,
  onChange,
  label,
  className = '',
  compact = false,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const popoverRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleHexChange = (input: string) => {
    setHexInput(input);
    let cleaned = input.trim();
    if (!cleaned.startsWith('#')) {
      cleaned = '#' + cleaned;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      onChange(cleaned);
    }
  };

  const handleEyedropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          onChange(result.sRGBHex);
          setHexInput(result.sRGBHex);
        }
      } catch (e) {
        // User cancelled eyedropper
      }
    } else {
      nativeInputRef.current?.click();
    }
  };

  const currentColor = value || '#10b981';

  if (compact) {
    return (
      <div className={`relative inline-block ${className}`} ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-7 h-7 rounded-full transition-transform hover:scale-105 active:scale-95 border-2 border-transparent hover:border-white/20 shadow-sm flex items-center justify-center p-0.5"
          style={{ backgroundColor: currentColor }}
          title={`Chọn màu: ${currentColor}`}
        />

        {isOpen && (
          <div className="absolute left-0 top-full mt-2 z-50 w-56 bg-black/60 border border-white/10 rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/5 mb-2.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full border border-white/10 shadow-inner"
                  style={{ backgroundColor: currentColor }}
                />
                <input
                  type="text"
                  value={hexInput}
                  onChange={(e) => handleHexChange(e.target.value)}
                  maxLength={7}
                  className="w-20 bg-transparent border-none px-1 py-0.5 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleEyedropper}
                  className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <Pipette className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {POPULAR_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.name}
                  onClick={() => {
                    onChange(preset.value);
                    setHexInput(preset.value);
                    setIsOpen(false);
                  }}
                  style={{ backgroundColor: preset.value }}
                  className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                    currentColor.toLowerCase() === preset.value.toLowerCase()
                      ? 'scale-110 ring-1 ring-white ring-offset-2 ring-offset-black'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} ref={popoverRef}>
      {label && (
        <label className="text-[11px] font-bold text-white/40 uppercase tracking-widest block">
          {label}
        </label>
      )}

      {/* Main Trigger & Quick Controls Bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex-1 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] border rounded-2xl px-4 py-3 transition-all duration-300 group ${
            isOpen ? 'border-white/20 shadow-lg bg-white/[0.05]' : 'border-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full shadow-inner border border-white/20 group-hover:scale-105 transition-transform shrink-0"
              style={{ backgroundColor: currentColor }}
            />
            <span className="text-sm font-mono font-medium text-white tracking-wide">
              {currentColor.toUpperCase()}
            </span>
          </div>

          <ChevronDown
            className={`w-4 h-4 text-white/30 group-hover:text-white/60 transition-transform duration-300 ${
              isOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </button>

        <input
          ref={nativeInputRef}
          type="color"
          value={currentColor}
          onChange={(e) => {
            onChange(e.target.value);
            setHexInput(e.target.value);
          }}
          className="sr-only"
        />
      </div>

      {/* Inline Expanded Palette */}
      {isOpen && (
        <div className="p-4 bg-black/40 border border-white/5 rounded-3xl space-y-5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Header Preview & Direct Hex Input */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white/[0.03] rounded-xl border border-white/5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">HEX</span>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#10B981"
                maxLength={7}
                className="w-20 bg-transparent text-xs font-mono font-bold text-white focus:outline-none uppercase"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => nativeInputRef.current?.click()}
                title="Bảng màu quang phổ"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleEyedropper}
                title="Hút màu trực tiếp từ màn hình"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <Pipette className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Standard Presets */}
          <div className="space-y-3">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-1">Bảng màu tiêu chuẩn</div>
            <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
              {POPULAR_COLORS.map((preset) => {
                const isSelected = currentColor.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    onClick={() => {
                      onChange(preset.value);
                      setHexInput(preset.value);
                    }}
                    style={{ backgroundColor: preset.value }}
                    className={`aspect-square rounded-full transition-all flex items-center justify-center ${
                      isSelected
                        ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black shadow-lg z-10'
                        : 'hover:scale-105 opacity-70 hover:opacity-100'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Pastel Presets */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-1">Màu nhạt (Pastel)</div>
            <div className="grid grid-cols-6 gap-2">
              {PASTEL_COLORS.map((preset) => {
                const isSelected = currentColor.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    onClick={() => {
                      onChange(preset.value);
                      setHexInput(preset.value);
                    }}
                    style={{ backgroundColor: preset.value }}
                    className={`aspect-square rounded-full transition-all flex items-center justify-center ${
                      isSelected
                        ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black shadow-lg z-10'
                        : 'hover:scale-105 opacity-70 hover:opacity-100'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
