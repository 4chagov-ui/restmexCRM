"use client";

import Link from "next/link";

type LocationsToolbarProps = {
  district: string;
  districts: string[];
  onDistrictChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  search: string;
};

export function LocationsToolbar({
  district,
  districts,
  onDistrictChange,
  onSearchChange,
  search,
}: LocationsToolbarProps) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-3 shadow-xl shadow-slate-200/60 backdrop-blur">
      <div className="grid gap-2 lg:grid-cols-[1fr_14rem_auto]">
        <label className="sr-only" htmlFor="location-search">
          Поиск заведений
        </label>
        <input
          className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          id="location-search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Поиск по названию, адресу, району или примечанию"
          type="search"
          value={search}
        />

        <label className="sr-only" htmlFor="district-filter">
          Фильтр по району
        </label>
        <select
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          id="district-filter"
          onChange={(event) => onDistrictChange(event.target.value)}
          value={district}
        >
          <option value="all">Все районы</option>
          {districts.map((districtOption) => (
            <option key={districtOption} value={districtOption}>
              {districtOption}
            </option>
          ))}
        </select>

        <Link
          className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-50"
          href="/locations/new"
        >
          Новое заведение
        </Link>
      </div>
    </div>
  );
}
