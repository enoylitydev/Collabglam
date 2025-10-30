import React, { useState } from "react";
import { HiPlus, HiTrash, HiChevronDown } from "react-icons/hi";

export function FloatingInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  [key: string]: any;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value !== "";

  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none peer"
        placeholder=" "
        {...props}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 transition-all duration-200 pointer-events-none ${
          focused || hasValue
            ? "top-2 text-xs text-[#FFA135] font-medium"
            : "top-1/2 -translate-y-1/2 text-sm text-gray-500"
        }`}
      >
        {label}
      </label>
    </div>
  );
}

export function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none appearance-none cursor-pointer bg-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <label
        htmlFor={id}
        className="absolute left-4 top-2 text-xs text-[#FFA135] font-medium pointer-events-none"
      >
        {label}
      </label>
      <HiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
    </div>
  );
}

export function NumberInput({
  id,
  label,
  value,
  onChange,
  min = 0,
  ...props
}: {
  id: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  [key: string]: any;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value || min)))}
        className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none"
        {...props}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-2 text-xs text-[#FFA135] font-medium pointer-events-none"
      >
        {label}
      </label>
    </div>
  );
}

export function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer transition-all duration-200 hover:border-[#FFA135] hover:bg-orange-50/50"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded border-2 border-gray-300 text-[#FFA135] focus:ring-2 focus:ring-[#FFA135] focus:ring-offset-2 cursor-pointer"
      />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}

export function PlatformSelector({
  platforms,
  onChange,
}: {
  platforms: string[];
  onChange: (platforms: string[]) => void;
}) {
  const options = [
    { value: "YouTube", icon: "▶" },
    { value: "Instagram", icon: "📷" },
    { value: "TikTok", icon: "🎵" },
  ];

  const toggle = (platform: string) => {
    onChange(
      platforms.includes(platform)
        ? platforms.filter((p) => p !== platform)
        : [...platforms, platform]
    );
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const isActive = platforms.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`p-3 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "border-transparent bg-gradient-to-br from-[#FFA135] to-[#FF7236] text-white shadow-md scale-105"
                : "border-gray-200 text-gray-600 hover:border-[#FFA135] hover:bg-orange-50/50"
            }`}
          >
            <div className="text-xl mb-1">{opt.icon}</div>
            <div>{opt.value}</div>
          </button>
        );
      })}
    </div>
  );
}

export function ChipInput({
  label,
  items,
  setItems,
  placeholder,
  validator,
}: {
  label: string;
  items: string[];
  setItems: (items: string[]) => void;
  placeholder?: string;
  validator?: (s: string) => boolean;
}) {
  const [value, setValue] = useState("");

  const add = () => {
    const v = value.trim();
    if (!v) return;
    if (validator && !validator(v)) {
      setValue("");
      return;
    }
    if (!items.includes(v)) setItems([...items, v]);
    setValue("");
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-100 to-orange-50 border border-orange-200 text-gray-700"
            >
              {item}
              <button
                type="button"
                className="p-0.5 rounded-full hover:bg-orange-200 transition-colors"
                onClick={() => setItems(items.filter((x) => x !== item))}
              >
                <HiTrash className="w-3 h-3 text-gray-600" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none"
          placeholder={placeholder || "Type and press +"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="px-4 py-2.5 rounded-lg bg-gradient-to-br from-[#FFA135] to-[#FF7236] text-white font-medium transition-all duration-200 hover:shadow-lg hover:scale-105"
        >
          <HiPlus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none resize-none"
      />
    </div>
  );
}
